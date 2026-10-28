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

// The moment the tests pretend it is: inside the class below, which runs 09:00 to 10:00.
const NOW = new Date('2026-09-10T09:30:00Z')

/** A class's times, as `class_sessions` returns them. */
function windowRow(courseId: string, startsAt: string, endsAt: string) {
  return { course_id: courseId, starts_at: startsAt, ends_at: endsAt }
}

/**
 * A service whose queries are answered by `answer`; `signedIn` false means nobody is signed in.
 * A read of `class_sessions` is answered with `windows` unless `answer` handles it itself.
 */
function setup(
  answer: (query: RecordedQuery) => TableAnswer,
  signedIn = true,
  windows: ReturnType<typeof windowRow>[] = [],
) {
  const { client, queries } = createFakeTables(
    (query) => (query.table === 'class_sessions' ? { data: windows, error: null } : answer(query)),
    signedIn ? { userId: TEACHER } : {},
  )
  return { service: createSupabaseTeachingService({ client, now: () => NOW }), queries }
}

describe('Supabase teaching service', () => {
  // Proves a signed-out caller is refused without any query.
  it('refuses a signed-out caller before asking the database', async () => {
    const { service, queries } = setup(() => ({ data: [], error: null }), false)
    await expect(service.listMyCourses()).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.getMyCourse(COURSE)).rejects.toMatchObject({ kind: 'unauthorized' })
    expect(queries).toHaveLength(0)
  })

  // Proves the list reads the teacher view, puts the courses with a class going on first and
  // orders by code within each group (D120).
  it('puts courses with a class going on first, then by code', async () => {
    const { service, queries } = setup(
      () => ({
        data: [
          courseRow({ id: 'c', code: 'C 100' }),
          courseRow({ id: 'o2', code: 'O 200' }),
          courseRow({ id: 'o1', code: 'O 100' }),
        ],
        error: null,
      }),
      true,
      [windowRow('c', '2026-09-10T09:00:00Z', '2026-09-10T10:00:00Z')],
    )
    const courses = await service.listMyCourses()
    expect(courses.map((course) => [course.id, course.inSession])).toEqual([
      ['c', true],
      ['o1', false],
      ['o2', false],
    ])
    expect(against(queries, 'teacher_courses')).toHaveLength(1)
  })

  // Proves "in session" follows the clock: the start counts, the end does not, and a class of
  // another course says nothing about this one.
  it.each([
    ['during a class', '2026-09-10T09:30:00Z', true],
    ['at the start', '2026-09-10T09:00:00Z', true],
    ['at the end', '2026-09-10T10:00:00Z', false],
    ['before it', '2026-09-10T08:00:00Z', false],
    ['after it', '2026-09-11T08:00:00Z', false],
  ])('says %s: inSession %s', async (_name, at, expected) => {
    const { client } = createFakeTables(
      (query) =>
        query.table === 'class_sessions'
          ? {
              data: [
                windowRow(COURSE, '2026-09-10T09:00:00Z', '2026-09-10T10:00:00Z'),
                windowRow('someone-elses', '2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z'),
              ],
              error: null,
            }
          : { data: [courseRow()], error: null },
      { userId: TEACHER },
    )
    const service = createSupabaseTeachingService({ client, now: () => new Date(at) })
    const [course] = await service.listMyCourses()
    expect(course?.inSession).toBe(expected)
  })

  // Proves the counts are passed on under the names the screens use.
  it('maps the counts', async () => {
    const { service } = setup(() => ({ data: [courseRow()], error: null }))
    await expect(service.listMyCourses()).resolves.toEqual([
      {
        id: COURSE,
        code: 'MTH 202',
        title: 'Linear Algebra',
        inSession: false,
        classCount: 2,
        waitingForReviewCount: 1,
      },
    ])
  })

  // SECURITY: proves a class time that is not text is refused instead of guessed at.
  it('refuses a class row with a malformed time', async () => {
    const { service } = setup(() => ({ data: [courseRow()], error: null }), true, [
      { course_id: COURSE, starts_at: 5, ends_at: null } as unknown as ReturnType<typeof windowRow>,
    ])
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
    expect(course).toMatchObject({ id: COURSE, code: 'MTH 202', inSession: false })
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
