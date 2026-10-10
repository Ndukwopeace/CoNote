/**
 * Tests for the Supabase dashboard services' own logic, against a fake client: which functions
 * they call with what, how they fill and order what comes back, and that a malformed answer is
 * refused. The real database and the health function are covered by the integration contract runs.
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The fake client, and the helper that asks what a query did.
import {
  createFakeTables,
  made,
  type TableAnswer,
  type RecordedQuery,
} from '@conote/testing/fakeTables'

// The services under test.
import type { FunctionResult } from './functionCall'
import { createSupabaseAlertService } from './supabaseAlertService'
import { createSupabaseAnalyticsService } from './supabaseAnalyticsService'
import { createSupabaseHealthService } from './supabaseHealthService'

/** Noon on 8 October 2026, local time. */
const NOW = new Date(2026, 9, 8, 12)

/** A client whose queries are answered by `answer`. */
function tables(answer: (query: RecordedQuery) => TableAnswer) {
  return createFakeTables(answer)
}

describe('analytics', () => {
  // Proves the six counts are asked for in the administrator's time zone and renamed for the screen.
  it('reads the overview', async () => {
    const { client, queries } = tables(() => ({
      data: [
        {
          students: 30,
          teachers: 4,
          active_courses: 6,
          classes_this_term: 12,
          published_summaries: 9,
          active_ai_jobs: 1,
        },
      ],
      error: null,
    }))
    const service = createSupabaseAnalyticsService({ client, timeZone: 'Africa/Lagos' })
    await expect(service.getOverview()).resolves.toEqual({
      students: 30,
      teachers: 4,
      activeCourses: 6,
      classesThisTerm: 12,
      publishedSummaries: 9,
      activeAiJobs: 1,
    })
    expect(made(queries[0]!, 'rpc', { p_tz: 'Africa/Lagos' })).toBe(true)
  })

  // Proves a missing or malformed overview is refused rather than shown as zeros.
  it('refuses an overview with no row, or a bad one', async () => {
    const none = createSupabaseAnalyticsService({
      client: tables(() => ({ data: [], error: null })).client,
    })
    await expect(none.getOverview()).rejects.toMatchObject({ kind: 'unknown' })
    const bad = createSupabaseAnalyticsService({
      client: tables(() => ({ data: [{ students: 'many' }], error: null })).client,
    })
    await expect(bad.getOverview()).rejects.toMatchObject({ kind: 'unknown' })
  })

  // Proves a refusal (not an administrator) reaches the screen as forbidden.
  it('reports a refused read', async () => {
    const service = createSupabaseAnalyticsService({
      client: tables(() => ({ data: null, error: { code: '42501', message: 'raw' } })).client,
    })
    await expect(service.getOverview()).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(service.getActivitySeries(7, 'notes_created')).rejects.toMatchObject({
      kind: 'forbidden',
    })
  })

  // Proves the chart covers every day of the range, with zero for days the database left out.
  it('fills the days the database left out', async () => {
    const { client, queries } = tables(() => ({
      data: [
        { day: '2026-10-08', count: 4 },
        { day: '2026-10-06', count: 2 },
      ],
      error: null,
    }))
    const service = createSupabaseAnalyticsService({ client, now: () => NOW, timeZone: 'UTC' })
    const points = await service.getActivitySeries(7, 'summaries_published')
    expect(points).toHaveLength(7)
    expect(points[0]).toEqual({ date: '2026-10-02', count: 0 })
    expect(points.find((point) => point.date === '2026-10-06')?.count).toBe(2)
    expect(points.at(-1)).toEqual({ date: '2026-10-08', count: 4 })
    expect(
      made(queries[0]!, 'rpc', {
        p_series: 'summaries_published',
        p_from: '2026-10-02',
        p_to: '2026-10-08',
        p_tz: 'UTC',
      }),
    ).toBe(true)
  })
})

describe('alerts', () => {
  /** A service over the rows the database function returns. */
  function over(rows: unknown) {
    const { client, queries } = tables(() => ({ data: rows, error: null }))
    return { service: createSupabaseAlertService({ client, now: () => NOW }), queries }
  }

  // Proves only kinds with something to report are returned, most urgent first, and the waiting
  // summaries carry the limit.
  it('returns the non-zero kinds in display order', async () => {
    const { service, queries } = over([
      { kind: 'enrollment_requests_waiting', count: 3, days: null },
      { kind: 'summaries_waiting_review', count: 2, days: 3 },
      { kind: 'storage_errors', count: 0, days: null },
      { kind: 'security_events', count: 1, days: null },
    ])
    await expect(service.listAlerts()).resolves.toEqual([
      { kind: 'security_events', count: 1 },
      { kind: 'summaries_waiting_review', count: 2, days: 3 },
      { kind: 'enrollment_requests_waiting', count: 3 },
    ])
    expect(made(queries[0]!, 'rpc', { p_now: NOW.toISOString() })).toBe(true)
  })

  // Proves a healthy platform raises nothing, and an unknown kind is refused.
  it('returns nothing when nothing is wrong, and refuses an unknown kind', async () => {
    await expect(over([]).service.listAlerts()).resolves.toEqual([])
    await expect(
      over([{ kind: 'meteor_strike', count: 1, days: null }]).service.listAlerts(),
    ).rejects.toMatchObject({ kind: 'unknown' })
  })
})

describe('health', () => {
  /** A service whose function answers `result`. */
  function over(result: FunctionResult) {
    const invoke = vi.fn<(name: string, body: Record<string, unknown>) => Promise<FunctionResult>>(
      () => Promise.resolve(result),
    )
    const { client } = tables(() => ({ data: null, error: null }))
    return { service: createSupabaseHealthService({ client, invoke }), invoke }
  }

  // Proves the report comes from the health function, with the parts it checked.
  it('returns the function’s report', async () => {
    const report = {
      checkedAt: '2026-10-08T12:00:00.000Z',
      components: { database: 'operational', storage: 'degraded' },
    }
    const { service, invoke } = over({ status: 200, body: report })
    await expect(service.getHealth()).resolves.toEqual(report)
    expect(invoke).toHaveBeenCalledWith('health', {})
  })

  // SECURITY: proves an unknown part or state never reaches the screen, and refusals pass through.
  it('refuses a malformed report, and passes refusals on', async () => {
    const bad = over({
      status: 200,
      body: { checkedAt: 'now', components: { database: 'on fire' } },
    })
    await expect(bad.service.getHealth()).rejects.toMatchObject({ kind: 'unknown' })
    const refused = over({
      status: 403,
      body: { error: { kind: 'forbidden', message: 'You do not have access to this.' } },
    })
    await expect(refused.service.getHealth()).rejects.toMatchObject({ kind: 'forbidden' })
  })
})
