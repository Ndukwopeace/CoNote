/**
 * Tests for the Supabase class service against a fake client.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client, and the helper that checks what was asked.
import {
  createFakeTables,
  made,
  type RecordedQuery,
  type TableAnswer,
} from '@conote/testing/fakeTables'

// The service under test.
import { createSupabaseClassService } from './supabaseClassService'

// Made-up IDs, shaped like the database's.
const COURSE = '20000000-0000-0000-0000-000000000001'
const CLASS_ONE = '30000000-0000-0000-0000-000000000001'
const CLASS_TWO = '30000000-0000-0000-0000-000000000002'

/** A class row as the database returns it. */
function classRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CLASS_ONE,
    course_id: COURSE,
    number: 1,
    title: 'Vectors',
    description: 'Magnitude and direction.',
    starts_at: '2026-10-01T09:00:00+00:00',
    ends_at: '2026-10-01T10:00:00+00:00',
    summary_status: 'published',
    ...overrides,
  }
}

/** What each table answers. */
interface Tables {
  class_sessions: TableAnswer
  courses: TableAnswer
}

/** Builds the service over a fake client that answers from `tables`. */
function setup(overrides: Partial<Tables> = {}) {
  const tables: Tables = {
    class_sessions: { data: [classRow()], error: null },
    courses: { data: { id: COURSE }, error: null },
    ...overrides,
  }
  const { client, queries } = createFakeTables((query: RecordedQuery) => {
    // The fake only knows these two tables.
    if (!(query.table in tables)) throw new Error(`Unexpected table ${query.table}`)
    return tables[query.table as keyof Tables]
  })
  return { service: createSupabaseClassService({ client }), queries }
}

describe('Supabase class service', () => {
  // Proves a course's classes come in number order, and are limited to that course.
  it('lists a course’s classes in number order', async () => {
    const { service, queries } = setup()

    const classes = await service.listClasses(COURSE)

    expect(classes).toEqual([
      {
        id: CLASS_ONE,
        courseId: COURSE,
        number: 1,
        title: 'Vectors',
        description: 'Magnitude and direction.',
        startsAt: '2026-10-01T09:00:00+00:00',
        endsAt: '2026-10-01T10:00:00+00:00',
        summaryStatus: 'published',
      },
    ])
    const read = queries.find((query) => query.table === 'class_sessions')!
    expect(made(read, 'eq', 'course_id', COURSE)).toBe(true)
    expect(made(read, 'order', 'number')).toBe(true)
  })

  // Proves a missing description leaves the field out.
  it('leaves out a missing description', async () => {
    const { service } = setup({
      class_sessions: { data: [classRow({ description: null })], error: null },
    })

    const [session] = await service.listClasses(COURSE)

    expect(session).not.toHaveProperty('description')
  })

  // Proves a course the student cannot read is not_found, but a course with no classes is empty.
  it('tells an unknown course from a course with no classes', async () => {
    const empty = setup({ class_sessions: { data: [], error: null } })
    await expect(empty.service.listClasses(COURSE)).resolves.toEqual([])

    const unknown = setup({ courses: { data: null, error: null } })
    await expect(unknown.service.listClasses(COURSE)).rejects.toMatchObject({ kind: 'not_found' })
  })

  // Proves every class is listed soonest first.
  it('lists all of the student’s classes soonest first', async () => {
    const { service, queries } = setup({
      class_sessions: {
        data: [classRow(), classRow({ id: CLASS_TWO, number: 2 })],
        error: null,
      },
    })

    const classes = await service.listMyClasses()

    expect(classes.map((c) => c.id)).toEqual([CLASS_ONE, CLASS_TWO])
    expect(made(queries[0]!, 'order', 'starts_at')).toBe(true)
  })

  // Proves one class is read by ID, and not found when no row comes back.
  it('reads one class, or reports it as not_found', async () => {
    const found = setup({ class_sessions: { data: classRow(), error: null } })
    await expect(found.service.getClass(CLASS_ONE)).resolves.toMatchObject({ id: CLASS_ONE })
    expect(made(found.queries[0]!, 'eq', 'id', CLASS_ONE)).toBe(true)

    const missing = setup({ class_sessions: { data: null, error: null } })
    await expect(missing.service.getClass(CLASS_ONE)).rejects.toMatchObject({ kind: 'not_found' })
  })

  // SECURITY: proves an ID that is not a UUID is refused before any query is built from it.
  it.each(['no-such-class', '', `${CLASS_ONE},id.neq.x`])(
    'refuses the ID %j without asking the database',
    async (id) => {
      const { service, queries } = setup()

      await expect(service.getClass(id)).rejects.toMatchObject({ kind: 'not_found' })
      await expect(service.listClasses(id)).rejects.toMatchObject({ kind: 'not_found' })
      expect(queries).toHaveLength(0)
    },
  )

  // Proves a failed summary run is shown to students as still processing, not as a failure.
  it('shows a failed summary as processing', async () => {
    const { service } = setup({
      class_sessions: { data: [classRow({ summary_status: 'failed' })], error: null },
    })

    const [session] = await service.listClasses(COURSE)

    expect(session?.summaryStatus).toBe('processing')
  })

  // Proves every other stage passes through unchanged.
  it.each(['collecting', 'processing', 'in_review', 'published'])(
    'passes the %s stage through',
    async (stage) => {
      const { service } = setup({
        class_sessions: { data: [classRow({ summary_status: stage })], error: null },
      })

      const [session] = await service.listClasses(COURSE)

      expect(session?.summaryStatus).toBe(stage)
    },
  )

  // Proves refusals and malformed rows become AppErrors.
  it('turns refusals and malformed rows into AppErrors', async () => {
    const refused = setup({
      class_sessions: { data: null, error: { code: '42501', message: 'permission denied' } },
    })
    await expect(refused.service.listMyClasses()).rejects.toMatchObject({ kind: 'forbidden' })

    const malformed = setup({
      class_sessions: { data: [classRow({ summary_status: 'leaked' })], error: null },
    })
    await expect(malformed.service.listMyClasses()).rejects.toMatchObject({ kind: 'unknown' })
  })
})
