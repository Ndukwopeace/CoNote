/**
 * Tests for the Supabase teaching service's own logic, against a fake client: which views it
 * reads, that it refuses a signed-out caller and a malformed ID before any query, and how it
 * orders and words its answers. The real database is covered by the integration contract run
 * (supabaseTeachingService.integration.test.ts).
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

/** The queries `queries` made against `table`. */
function against(queries: RecordedQuery[], table: string) {
  return queries.filter((query) => query.table === table)
}

// The service under test.
import { createSupabaseTeachingService } from './supabaseTeachingService'

// IDs the tests use.
const TEACHER = '10000000-0000-4000-8000-000000000001'
const COURSE = '20000000-0000-4000-8000-000000000001'

/** A course as the list view returns it. */
function courseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COURSE,
    code: 'MTH 202',
    title: 'Linear Algebra',
    status: 'ongoing',
    class_count: 2,
    waiting_for_review_count: 1,
    ...overrides,
  }
}

/** A class as the view returns it. */
function classRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '40000000-0000-4000-8000-000000000001',
    number: 1,
    title: 'Vectors',
    starts_at: '2026-09-10T09:00:00+00:00',
    note_count: 4,
    summary_id: null,
    summary_status: null,
    published_at: null,
    ...overrides,
  }
}

/** A service whose queries are answered by `answer`; `signedIn` false means nobody is signed in. */
function setup(answer: (query: RecordedQuery) => TableAnswer, signedIn = true) {
  const { client, queries } = createFakeTables(answer, signedIn ? { userId: TEACHER } : {})
  return { service: createSupabaseTeachingService({ client }), queries }
}

describe('Supabase teaching service', () => {
  // Proves a signed-out caller is refused without any query.
  it('refuses a signed-out caller before asking the database', async () => {
    const { service, queries } = setup(() => ({ data: [], error: null }), false)
    await expect(service.listMyCourses()).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.getMyCourse(COURSE)).rejects.toMatchObject({ kind: 'unauthorized' })
    expect(queries).toHaveLength(0)
  })

  // Proves the list reads the teacher view and orders ongoing first, then upcoming, then
  // completed, by code within each.
  it('orders courses by status, then code', async () => {
    const { service, queries } = setup(() => ({
      data: [
        courseRow({ id: 'c', code: 'C 100', status: 'completed' }),
        courseRow({ id: 'u', code: 'U 100', status: 'upcoming' }),
        courseRow({ id: 'o2', code: 'O 200' }),
        courseRow({ id: 'o1', code: 'O 100' }),
      ],
      error: null,
    }))
    const courses = await service.listMyCourses()
    expect(courses.map((course) => course.id)).toEqual(['o1', 'o2', 'u', 'c'])
    expect(against(queries, 'teacher_courses')).toHaveLength(1)
  })

  // Proves the counts are passed on under the names the screens use.
  it('maps the counts', async () => {
    const { service } = setup(() => ({ data: [courseRow()], error: null }))
    await expect(service.listMyCourses()).resolves.toEqual([
      {
        id: COURSE,
        code: 'MTH 202',
        title: 'Linear Algebra',
        status: 'ongoing',
        classCount: 2,
        waitingForReviewCount: 1,
      },
    ])
  })

  // SECURITY: proves a status the app does not know is refused instead of shown.
  it('refuses a row with an unknown status', async () => {
    const { service } = setup(() => ({ data: [courseRow({ status: 'secret' })], error: null }))
    await expect(service.listMyCourses()).rejects.toBeInstanceOf(Error)
  })

  // SECURITY: proves an ID that is not a UUID answers "not found" without a query.
  it('answers not_found for a malformed course ID without a query', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null }))
    await expect(service.getMyCourse('1 or 1=1')).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries).toHaveLength(0)
  })

  // Proves a course the view does not show (someone else's, archived, unknown) is "not found".
  it('answers not_found when the view shows no course', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null }))
    await expect(service.getMyCourse(COURSE)).rejects.toMatchObject({ kind: 'not_found' })
    // The classes are never asked for.
    expect(against(queries, 'teacher_classes')).toHaveLength(0)
  })

  // Proves a course comes back with its classes, newest first, each with its stage.
  it('returns the course with its classes and their stages', async () => {
    const { service, queries } = setup((query) =>
      query.table === 'teacher_courses'
        ? { data: courseRow(), error: null }
        : {
            data: [
              classRow({
                id: 'k2',
                number: 2,
                summary_id: 's2',
                summary_status: 'published',
                published_at: '2026-09-12T10:00:00+00:00',
              }),
              classRow(),
            ],
            error: null,
          },
    )
    const course = await service.getMyCourse(COURSE)
    expect(course).toMatchObject({ id: COURSE, code: 'MTH 202', status: 'ongoing' })
    expect(course.classes).toEqual([
      {
        id: 'k2',
        number: 2,
        title: 'Vectors',
        startsAt: '2026-09-10T09:00:00.000Z',
        noteCount: 4,
        summaryId: 's2',
        stage: 'published',
        publishedAt: '2026-09-12T10:00:00.000Z',
      },
      {
        id: '40000000-0000-4000-8000-000000000001',
        number: 1,
        title: 'Vectors',
        startsAt: '2026-09-10T09:00:00.000Z',
        noteCount: 4,
        summaryId: null,
        stage: 'collecting',
        publishedAt: null,
      },
    ])
    // The classes are asked for newest first.
    const [classQuery] = against(queries, 'teacher_classes')
    expect(classQuery && made(classQuery, 'order', 'number', { ascending: false })).toBe(true)
  })
})
