/**
 * Tests for the Supabase review service's own logic, against a fake client: which view and
 * functions it uses, that it refuses a signed-out caller, a malformed ID and an invalid draft
 * before any query, and how it words each refusal. The real database is covered by the
 * integration contract run (supabaseReviewService.integration.test.ts).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client, and the helper that asks what a query did.
import {
  createFakeTables,
  made,
  type RecordedQuery,
  type TableAnswer,
} from '@conote/testing/fakeTables'

// The draft the tests send.
import type { SummaryDraft } from '@/types/review'

// The service under test.
import { createSupabaseReviewService } from './supabaseReviewService'

// IDs the tests use.
const TEACHER = '10000000-0000-4000-8000-000000000001'
const SUMMARY = '30000000-0000-4000-8000-000000000001'

/** A valid draft. */
const DRAFT: SummaryDraft = {
  overview: 'Vectors and spaces.',
  keyConcepts: [{ id: 'c1', title: 'Basis', explanation: 'A minimal spanning set.' }],
  confusionAreas: [{ id: 'f1', issue: 'Span vs basis', clarification: 'A basis is independent.' }],
  keyTopics: [{ id: 't1', name: 'Rank', description: '' }],
}

/** A summary as the review view returns it. */
function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    summary_id: SUMMARY,
    course_id: '20000000-0000-4000-8000-000000000001',
    course_code: 'MTH 202',
    course_title: 'Linear Algebra',
    class_number: 4,
    class_title: 'Week 4',
    status: 'in_review',
    version: 3,
    overview: 'AI draft.',
    key_concepts: [{ id: 'c1', title: 'Basis', explanation: 'A set.' }],
    confusion_areas: [],
    key_topics: [],
    notes_analyzed_count: 18,
    students_analyzed_count: 14,
    in_review_since: '2026-10-07T12:00:00+00:00',
    published_at: null,
    reviewed_by_name: null,
    ...overrides,
  }
}

/** A refused call, as PostgREST reports it. */
const refusal = (code: string) => ({ data: null, error: { code, message: 'raw' } })

/** The queries `queries` made against `table`. */
function against(queries: RecordedQuery[], table: string) {
  return queries.filter((query) => query.table === table)
}

/** A service whose queries are answered by `answer`; `signedIn` false means nobody is. */
function setup(answer: (query: RecordedQuery) => TableAnswer, signedIn = true) {
  const { client, queries } = createFakeTables(answer, signedIn ? { userId: TEACHER } : {})
  return { service: createSupabaseReviewService({ client }), queries }
}

describe('Supabase review service', () => {
  // Proves a signed-out caller is refused without any query.
  it('refuses a signed-out caller before asking the database', async () => {
    const { service, queries } = setup(() => ({ data: [], error: null }), false)
    await expect(service.listReviewQueue()).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.getDraft(SUMMARY)).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.saveDraft(SUMMARY, DRAFT, 1)).rejects.toMatchObject({
      kind: 'unauthorized',
    })
    await expect(service.approveAndPublish(SUMMARY, DRAFT, 1)).rejects.toMatchObject({
      kind: 'unauthorized',
    })
    expect(queries).toHaveLength(0)
  })

  describe('listReviewQueue', () => {
    // Proves the queue asks only for summaries in review, longest wait first, and maps them.
    it('lists the summaries in review, oldest wait first', async () => {
      const { service, queries } = setup(() => ({ data: [reviewRow()], error: null }))
      await expect(service.listReviewQueue()).resolves.toEqual([
        {
          summaryId: SUMMARY,
          courseId: '20000000-0000-4000-8000-000000000001',
          courseCode: 'MTH 202',
          classNumber: 4,
          classTitle: 'Week 4',
          inReviewSince: '2026-10-07T12:00:00.000Z',
          notesAnalyzedCount: 18,
        },
      ])
      const [query] = against(queries, 'teacher_reviews')
      expect(query && made(query, 'eq', 'status', 'in_review')).toBe(true)
      expect(query && made(query, 'order', 'in_review_since', { ascending: true })).toBe(true)
    })

    // Proves a row with no review time is left out rather than shown with a made-up one.
    it('leaves out a row without a review time', async () => {
      const { service } = setup(() => ({
        data: [reviewRow({ in_review_since: null })],
        error: null,
      }))
      await expect(service.listReviewQueue()).resolves.toEqual([])
    })

    // SECURITY: proves a stage the app does not know is refused instead of shown.
    it('refuses a row with an unknown stage', async () => {
      const { service } = setup(() => ({ data: [reviewRow({ status: 'secret' })], error: null }))
      await expect(service.listReviewQueue()).rejects.toBeInstanceOf(Error)
    })
  })

  describe('getDraft', () => {
    // SECURITY: proves an ID that is not a UUID answers "not found" without a query.
    it('answers not_found for a malformed ID without a query', async () => {
      const { service, queries } = setup(() => ({ data: null, error: null }))
      await expect(service.getDraft('1 or 1=1')).rejects.toMatchObject({ kind: 'not_found' })
      expect(queries).toHaveLength(0)
    })

    // Proves a summary the view does not show (someone else's, archived, unknown) is not found.
    it('answers not_found when the view shows no summary', async () => {
      const { service } = setup(() => ({ data: null, error: null }))
      await expect(service.getDraft(SUMMARY)).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves the summary comes back as the screen shows it, a published one with its reviewer.
    it('returns the summary with its draft, counts and reviewer', async () => {
      const { service } = setup(() => ({
        data: reviewRow({
          status: 'published',
          published_at: '2026-10-12T10:00:00+00:00',
          reviewed_by_name: 'Sarah Mbarga',
        }),
        error: null,
      }))
      await expect(service.getDraft(SUMMARY)).resolves.toEqual({
        summaryId: SUMMARY,
        courseId: '20000000-0000-4000-8000-000000000001',
        courseCode: 'MTH 202',
        courseTitle: 'Linear Algebra',
        classNumber: 4,
        classTitle: 'Week 4',
        status: 'published',
        version: 3,
        draft: {
          overview: 'AI draft.',
          keyConcepts: [{ id: 'c1', title: 'Basis', explanation: 'A set.' }],
          confusionAreas: [],
          keyTopics: [],
        },
        notesAnalyzedCount: 18,
        studentCount: 14,
        inReviewSince: '2026-10-07T12:00:00.000Z',
        publishedAt: '2026-10-12T10:00:00.000Z',
        reviewedBy: 'Sarah Mbarga',
      })
    })
  })

  describe.each([
    ['saveDraft', 'save_summary_draft'],
    ['approveAndPublish', 'publish_summary_draft'],
  ] as const)('%s', (method, functionName) => {
    /** Answers the function with `result` and the view with the saved summary. */
    function answerWith(result: TableAnswer) {
      return (query: RecordedQuery): TableAnswer =>
        query.table === `rpc:${functionName}` ? result : { data: reviewRow(), error: null }
    }

    // Proves the draft goes to the database function with the version, then is read back.
    it('sends the draft and version to the database function', async () => {
      const { service, queries } = setup(answerWith({ data: null, error: null }))
      const saved = await service[method](SUMMARY, DRAFT, 3)
      expect(saved.summaryId).toBe(SUMMARY)
      const [call] = against(queries, `rpc:${functionName}`)
      expect(call?.calls[0]).toEqual([
        'rpc',
        {
          p_summary: SUMMARY,
          p_version: 3,
          p_overview: 'Vectors and spaces.',
          p_key_concepts: DRAFT.keyConcepts,
          p_confusion_areas: DRAFT.confusionAreas,
          p_key_topics: DRAFT.keyTopics,
        },
      ])
    })

    // Proves an invalid draft is refused with the form's message, before any call.
    it('refuses an invalid draft before calling the database', async () => {
      const { service, queries } = setup(answerWith({ data: null, error: null }))
      await expect(service[method](SUMMARY, { ...DRAFT, overview: '  ' }, 3)).rejects.toMatchObject(
        {
          kind: 'validation',
          message: 'Enter the overview.',
        },
      )
      expect(queries).toHaveLength(0)
    })

    // SECURITY: proves a malformed ID answers "not found" without a call.
    it('answers not_found for a malformed ID without a call', async () => {
      const { service, queries } = setup(answerWith({ data: null, error: null }))
      await expect(service[method]('x', DRAFT, 3)).rejects.toMatchObject({ kind: 'not_found' })
      expect(queries).toHaveLength(0)
    })

    // Proves each refusal from the function becomes the error the screen expects.
    it.each([
      ['P0002', 'not_found'],
      ['40001', 'conflict'],
      ['23514', 'conflict'],
      ['22023', 'validation'],
      ['42501', 'forbidden'],
    ])('turns the database code %s into %s', async (code, kind) => {
      const { service } = setup(answerWith(refusal(code)))
      await expect(service[method](SUMMARY, DRAFT, 3)).rejects.toMatchObject({ kind })
    })
  })
})
