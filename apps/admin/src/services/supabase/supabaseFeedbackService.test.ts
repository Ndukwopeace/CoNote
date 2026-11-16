/**
 * Tests for the admin feedback service on Supabase (D125), against a fake client: what is sent to
 * the two administrator functions, how rows become feedback, and that a bad ID or a bad row is
 * refused. Who may call them is tested in the database.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client, and the helper that asks what a query did.
import { createFakeTables, made } from '@conote/testing/fakeTables'

// The unit under test.
import { createSupabaseAdminFeedbackService } from './supabaseFeedbackService'

/** One row as `admin_list_feedback` returns it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '10000000-0000-0000-0000-000000000001',
    kind: 'idea',
    message: 'Dark mode please',
    rating: 4,
    page: '/dashboard',
    status: 'new',
    created_at: '2026-11-10T09:00:00Z',
    sender_name: 'Ada Student',
    sender_email: 'ada@example.com',
    sender_role: 'student',
    total_count: 7,
    ...overrides,
  }
}

describe('listFeedback', () => {
  // Proves the filter is sent as the function's arguments, rows are renamed, and the total is read.
  it('sends the filter and reads the page', async () => {
    const { client, queries } = createFakeTables(() => ({ data: [row()], error: null }))

    const page = await createSupabaseAdminFeedbackService({ client }).listFeedback({
      status: 'new',
      kind: 'idea',
      offset: 20,
    })

    expect(
      made(queries[0]!, 'rpc', { p_status: 'new', p_kind: 'idea', p_limit: 20, p_offset: 20 }),
    ).toBe(true)
    expect(page.total).toBe(7)
    expect(page.items[0]).toEqual({
      id: '10000000-0000-0000-0000-000000000001',
      kind: 'idea',
      message: 'Dark mode please',
      rating: 4,
      page: '/dashboard',
      status: 'new',
      createdAt: '2026-11-10T09:00:00Z',
      senderName: 'Ada Student',
      senderEmail: 'ada@example.com',
      senderRole: 'student',
    })
  })

  // Proves no matches is an empty page with a zero total, and unset filters go as null.
  it('answers an empty page when nothing matches', async () => {
    const { client, queries } = createFakeTables(() => ({ data: [], error: null }))

    const page = await createSupabaseAdminFeedbackService({ client }).listFeedback({})

    expect(page).toEqual({ items: [], total: 0 })
    expect(
      made(queries[0]!, 'rpc', { p_status: null, p_kind: null, p_limit: 20, p_offset: 0 }),
    ).toBe(true)
  })

  // Proves a refusal reaches the screen as forbidden, and a row of the wrong shape is refused.
  it('reports a refusal and refuses a malformed row', async () => {
    const refused = createFakeTables(() => ({
      data: null,
      error: { code: '42501', message: 'raw' },
    }))
    await expect(
      createSupabaseAdminFeedbackService({ client: refused.client }).listFeedback({}),
    ).rejects.toMatchObject({ kind: 'forbidden' })

    const broken = createFakeTables(() => ({ data: [row({ kind: 'rant' })], error: null }))
    await expect(
      createSupabaseAdminFeedbackService({ client: broken.client }).listFeedback({}),
    ).rejects.toBeInstanceOf(Error)
  })
})

describe('setFeedbackStatus', () => {
  // Proves the change is sent to the database function.
  it('sends the new status', async () => {
    const { client, queries } = createFakeTables(() => ({ data: null, error: null }))

    await createSupabaseAdminFeedbackService({ client }).setFeedbackStatus(
      '10000000-0000-0000-0000-000000000001',
      'read',
    )

    expect(
      made(queries[0]!, 'rpc', { p_id: '10000000-0000-0000-0000-000000000001', p_status: 'read' }),
    ).toBe(true)
  })

  // SECURITY: proves an ID that is not a UUID is "not found" and never reaches the database.
  it('answers not found for a malformed ID without calling', async () => {
    const { client, queries } = createFakeTables(() => ({ data: null, error: null }))

    await expect(
      createSupabaseAdminFeedbackService({ client }).setFeedbackStatus('1; drop table x', 'read'),
    ).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries).toHaveLength(0)
  })

  // Proves the database's "not found" comes through as that error.
  it('reports an unknown piece of feedback', async () => {
    const { client } = createFakeTables(() => ({
      data: null,
      error: { code: 'P0002', message: 'x' },
    }))

    await expect(
      createSupabaseAdminFeedbackService({ client }).setFeedbackStatus(
        '10000000-0000-0000-0000-000000000001',
        'read',
      ),
    ).rejects.toMatchObject({ kind: 'not_found' })
  })
})
