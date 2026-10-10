/**
 * Tests for the Supabase summary service against a fake client: how a summary is joined to its
 * teacher and to the student's views, and how refusals and bad rows are handled.
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
import { createSupabaseSummaryService } from './supabaseSummaryService'

// Made-up IDs, shaped like the database's.
const SUMMARY = '60000000-0000-0000-0000-000000000001'
const OTHER = '60000000-0000-0000-0000-000000000002'
const CLASS = '30000000-0000-0000-0000-000000000001'
const COURSE = '20000000-0000-0000-0000-000000000001'
const TEACHER = '10000000-0000-0000-0000-000000000002'

/** A summary row as the database returns it. */
function summaryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SUMMARY,
    class_id: CLASS,
    course_id: COURSE,
    overview: 'Vectors have magnitude and direction.',
    key_concepts: [{ id: 'k1', title: 'Vector', explanation: 'A quantity with direction.' }],
    confusion_areas: [{ id: 'c1', issue: 'Dot or cross?', clarification: 'Dot gives a number.' }],
    key_topics: [
      { id: 't1', name: 'Vectors' },
      { id: 't2', name: 'Scalars', description: 'Numbers.' },
    ],
    notes_analyzed_count: 7,
    reviewed_by: TEACHER,
    published_at: '2026-10-02T09:00:00+00:00',
    ...overrides,
  }
}

/** What each kind of call answers. */
interface Answers {
  // Reading summaries (list or one).
  read: TableAnswer
  teachers: TableAnswer
  views: TableAnswer
  // The result of recording a view.
  recordView: TableAnswer
}

/** Builds the service over a fake client that answers from `answers`. */
function setup(overrides: Partial<Answers> = {}) {
  const answers: Answers = {
    read: { data: [summaryRow()], error: null },
    teachers: {
      data: [{ id: TEACHER, full_name: 'Sarah Mbarga', avatar_url: null, course_id: COURSE }],
      error: null,
    },
    views: { data: [], error: null },
    recordView: { data: null, error: null },
    ...overrides,
  }
  const { client, queries } = createFakeTables((query: RecordedQuery) => {
    if (query.table === 'course_teachers') return answers.teachers
    if (query.table === 'summary_views') {
      return query.calls.some(([name]) => name === 'insert') ? answers.recordView : answers.views
    }
    if (query.table !== 'summaries') throw new Error(`Unexpected table ${query.table}`)
    return answers.read
  })
  return { service: createSupabaseSummaryService({ client }), queries }
}

describe('Supabase summary service: reading', () => {
  // Proves a row becomes the summary the pages show, with the teacher and the student's views.
  it('lists published summaries with teacher and viewed state', async () => {
    const { service, queries } = setup({
      read: {
        // In the order the database returns them: newest first.
        data: [
          summaryRow({
            id: OTHER,
            class_id: '30000000-0000-0000-0000-000000000002',
            published_at: '2026-10-05T09:00:00+00:00',
          }),
          summaryRow(),
        ],
        error: null,
      },
      views: { data: [{ summary_id: OTHER }], error: null },
    })

    const summaries = await service.listPublished()

    // Newest first: the database is asked to sort, and the order is kept.
    expect(made(queries[0]!, 'order', 'published_at', { ascending: false })).toBe(true)
    expect(summaries.map((s) => s.id)).toEqual([OTHER, SUMMARY])
    expect(summaries[1]).toEqual({
      id: SUMMARY,
      classId: CLASS,
      courseId: COURSE,
      overview: 'Vectors have magnitude and direction.',
      keyConcepts: [{ id: 'k1', title: 'Vector', explanation: 'A quantity with direction.' }],
      confusionAreas: [{ id: 'c1', issue: 'Dot or cross?', clarification: 'Dot gives a number.' }],
      keyTopics: [
        { id: 't1', name: 'Vectors' },
        { id: 't2', name: 'Scalars', description: 'Numbers.' },
      ],
      notesAnalyzedCount: 7,
      reviewedBy: { id: TEACHER, fullName: 'Sarah Mbarga' },
      publishedAt: '2026-10-02T09:00:00+00:00',
      viewedByMe: false,
    })
    expect(summaries[0]?.viewedByMe).toBe(true)
  })

  // Proves the course filter is sent as an exact match, and a filter that is not a UUID lists nothing.
  it('filters by course', async () => {
    const { service, queries } = setup()

    await service.listPublished({ courseId: COURSE })
    expect(made(queries[0]!, 'eq', 'course_id', COURSE)).toBe(true)

    // SECURITY: a filter that is not a UUID is not used in a query.
    const other = setup()
    await expect(other.service.listPublished({ courseId: 'x,id.neq.0' })).resolves.toEqual([])
    expect(other.queries).toHaveLength(0)
  })

  // Proves a summary whose teacher cannot be found is still shown, with a stand-in name.
  it('copes with a course that has no teacher', async () => {
    const { service } = setup({ teachers: { data: [], error: null } })

    const [summary] = await service.listPublished()

    expect(summary?.reviewedBy).toEqual({ id: TEACHER, fullName: 'Your teacher' })
  })

  // Proves a teacher's picture is kept when there is one.
  it('keeps the teacher’s picture', async () => {
    const { service } = setup({
      teachers: {
        data: [
          { id: TEACHER, full_name: 'Sarah', avatar_url: 'https://x/a.png', course_id: COURSE },
        ],
        error: null,
      },
    })

    const [summary] = await service.listPublished()

    expect(summary?.reviewedBy).toEqual({
      id: TEACHER,
      fullName: 'Sarah',
      avatarUrl: 'https://x/a.png',
    })
  })

  // Proves an empty list needs no follow-up reads.
  it('returns an empty list without further reads', async () => {
    const { service, queries } = setup({ read: { data: [], error: null } })

    await expect(service.listPublished()).resolves.toEqual([])
    expect(queries).toHaveLength(1)
  })

  // Proves one class's summary is read by class, and a missing one is not_found.
  it('reads a summary by class, or reports it as not_found', async () => {
    const found = setup({ read: { data: summaryRow(), error: null } })
    await expect(found.service.getByClass(CLASS)).resolves.toMatchObject({ id: SUMMARY })
    expect(made(found.queries[0]!, 'eq', 'class_id', CLASS)).toBe(true)

    // SECURITY: a draft is never visible to Row Level Security, so it reads as no row at all.
    const missing = setup({ read: { data: null, error: null } })
    await expect(missing.service.getByClass(CLASS)).rejects.toMatchObject({ kind: 'not_found' })
  })

  // SECURITY: proves an ID that is not a UUID is refused before any query is built from it.
  it('refuses IDs that are not UUIDs without asking the database', async () => {
    const { service, queries } = setup()

    await expect(service.getByClass('no-such-class')).rejects.toMatchObject({ kind: 'not_found' })
    await expect(service.markViewed('no-such-summary')).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries).toHaveLength(0)
  })

  // SECURITY: proves a row of the wrong shape (an unknown content shape) is refused, not shown.
  it('refuses a malformed summary', async () => {
    const { service } = setup({
      read: { data: [summaryRow({ key_concepts: [{ id: 'k1' }] })], error: null },
    })

    await expect(service.listPublished()).rejects.toMatchObject({ kind: 'unknown' })
  })

  // Proves a refused read is an AppError with a safe message.
  it('turns a refused read into an AppError', async () => {
    const { service } = setup({
      read: { data: null, error: { code: '42501', message: 'permission denied' } },
    })

    await expect(service.listPublished()).rejects.toMatchObject({ kind: 'forbidden' })
  })
})

describe('Supabase summary service: marking viewed', () => {
  // Proves a view is recorded with the summary only; the database supplies the student.
  it('records a view', async () => {
    const { service, queries } = setup({ read: { data: { id: SUMMARY }, error: null } })

    await expect(service.markViewed(SUMMARY)).resolves.toBeUndefined()

    // SECURITY: no student ID is sent; the database sets it to the signed-in student.
    const write = queries.find((q) => q.table === 'summary_views')!
    expect(write.calls.find(([name]) => name === 'insert')?.[1]).toEqual({ summary_id: SUMMARY })
  })

  // Proves viewing twice is harmless.
  it('treats an already recorded view as done', async () => {
    const { service } = setup({
      read: { data: { id: SUMMARY }, error: null },
      recordView: { data: null, error: { code: '23505', message: 'duplicate key' } },
    })

    await expect(service.markViewed(SUMMARY)).resolves.toBeUndefined()
  })

  // Proves a summary the student cannot read is not_found, and nothing is recorded for it.
  it('reports an unreadable summary as not_found', async () => {
    const { service, queries } = setup({ read: { data: null, error: null } })

    await expect(service.markViewed(SUMMARY)).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries.some((q) => q.table === 'summary_views')).toBe(false)
  })

  // Proves the database refusing the view (the summary was unpublished meanwhile) reads as not_found.
  it('reports a refused view as not_found', async () => {
    const { service } = setup({
      read: { data: { id: SUMMARY }, error: null },
      recordView: { data: null, error: { code: '42501', message: 'row-level security' } },
    })

    await expect(service.markViewed(SUMMARY)).rejects.toMatchObject({ kind: 'not_found' })
  })

  // Proves other failures are not hidden.
  it('passes other failures on', async () => {
    const { service } = setup({
      read: { data: { id: SUMMARY }, error: null },
      recordView: { data: null, error: { name: 'AuthRetryableFetchError', message: 'offline' } },
    })

    await expect(service.markViewed(SUMMARY)).rejects.toMatchObject({ kind: 'network' })
  })
})
