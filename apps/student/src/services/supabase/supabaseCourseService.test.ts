/**
 * Tests for the Supabase course service against a fake client: what it asks for, how it joins the
 * four reads into one course, and how it copes with refusals and bad rows.
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
import { createSupabaseCourseService } from './supabaseCourseService'

// Made-up IDs, shaped like the database's.
const COURSE = '20000000-0000-0000-0000-000000000001'
const OTHER = '20000000-0000-0000-0000-000000000002'
const TEACHER = '10000000-0000-0000-0000-000000000002'

/** A course row as the database returns it. */
function courseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COURSE,
    code: 'MTH 202',
    title: 'Linear Algebra',
    description: 'Vectors and matrices.',
    status: 'ongoing',
    schedule_text: 'Mon & Wed, 9–11am',
    ...overrides,
  }
}

/** What each table answers; a test replaces the parts it cares about. */
interface Tables {
  courses: TableAnswer
  course_teachers: TableAnswer
  class_sessions: TableAnswer
  course_student_counts: TableAnswer
}

/** Builds the service over a fake client that answers from `tables`. */
function setup(overrides: Partial<Tables> = {}) {
  const tables: Tables = {
    courses: { data: [courseRow()], error: null },
    course_teachers: {
      data: [{ id: TEACHER, full_name: 'Sarah Mbarga', avatar_url: null, course_id: COURSE }],
      error: null,
    },
    class_sessions: {
      data: [
        { id: 'c1', course_id: COURSE },
        { id: 'c2', course_id: COURSE },
      ],
      error: null,
    },
    course_student_counts: { data: [{ course_id: COURSE, student_count: 5 }], error: null },
    ...overrides,
  }
  const { client, queries } = createFakeTables((query: RecordedQuery) => {
    // The fake only knows these four tables.
    if (!(query.table in tables)) throw new Error(`Unexpected table ${query.table}`)
    return tables[query.table as keyof Tables]
  })
  return { service: createSupabaseCourseService({ client }), queries }
}

describe('Supabase course service', () => {
  // Proves the four reads become one course with the fields the pages show.
  it('lists the student’s courses with teacher and counts', async () => {
    const { service, queries } = setup()

    const courses = await service.listMyCourses()

    expect(courses).toEqual([
      {
        id: COURSE,
        code: 'MTH 202',
        title: 'Linear Algebra',
        description: 'Vectors and matrices.',
        teacher: { id: TEACHER, fullName: 'Sarah Mbarga' },
        studentCount: 5,
        classCount: 2,
        status: 'ongoing',
        scheduleText: 'Mon & Wed, 9–11am',
      },
    ])
    // Courses come in code order, and the follow-up reads name only the courses found.
    expect(made(queries[0]!, 'order', 'code')).toBe(true)
    for (const query of queries.slice(1))
      expect(made(query, 'in', 'course_id', [COURSE])).toBe(true)
  })

  // Proves a course with no schedule leaves the field out, and a teacher's picture is kept.
  it('leaves out a missing schedule and keeps a teacher’s picture', async () => {
    const { service } = setup({
      courses: { data: [courseRow({ schedule_text: null })], error: null },
      course_teachers: {
        data: [
          { id: TEACHER, full_name: 'Sarah', avatar_url: 'https://x/a.png', course_id: COURSE },
        ],
        error: null,
      },
    })

    const [course] = await service.listMyCourses()

    expect(course).not.toHaveProperty('scheduleText')
    expect(course?.teacher).toEqual({
      id: TEACHER,
      fullName: 'Sarah',
      avatarUrl: 'https://x/a.png',
    })
  })

  // Proves a course nobody teaches yet, or with no counts, still reads sensibly.
  it('copes with no teacher and no counts', async () => {
    const { service } = setup({
      course_teachers: { data: [], error: null },
      class_sessions: { data: [], error: null },
      course_student_counts: { data: [], error: null },
    })

    const [course] = await service.listMyCourses()

    expect(course?.teacher).toEqual({ id: '', fullName: 'Not assigned yet' })
    expect(course).toMatchObject({ studentCount: 0, classCount: 0 })
  })

  // Proves a student in no course gets an empty list without further reads.
  it('returns an empty list when the student is in no course', async () => {
    const { service, queries } = setup({ courses: { data: [], error: null } })

    await expect(service.listMyCourses()).resolves.toEqual([])
    expect(queries).toHaveLength(1)
  })

  // Proves counts are matched to the right course.
  it('matches counts to their own course', async () => {
    const { service } = setup({
      courses: {
        data: [courseRow(), courseRow({ id: OTHER, code: 'SWE 311', title: 'Software' })],
        error: null,
      },
      class_sessions: {
        data: [
          { id: 'c1', course_id: OTHER },
          { id: 'c2', course_id: OTHER },
          { id: 'c3', course_id: OTHER },
        ],
        error: null,
      },
      course_student_counts: { data: [{ course_id: OTHER, student_count: 9 }], error: null },
    })

    const courses = await service.listMyCourses()

    expect(courses.map((c) => [c.code, c.classCount, c.studentCount])).toEqual([
      ['MTH 202', 0, 0],
      ['SWE 311', 3, 9],
    ])
  })

  // Proves one course is read by its ID, and the read is limited to that ID.
  it('reads one course', async () => {
    const { service, queries } = setup()

    await expect(service.getCourse(COURSE)).resolves.toMatchObject({ id: COURSE, code: 'MTH 202' })
    expect(made(queries[0]!, 'eq', 'id', COURSE)).toBe(true)
  })

  // Proves an unknown or unreadable course is not_found, whether or not it exists.
  it('reports a course that returns no row as not_found', async () => {
    const { service } = setup({ courses: { data: [], error: null } })

    await expect(service.getCourse(COURSE)).rejects.toMatchObject({ kind: 'not_found' })
  })

  // SECURITY: proves an ID that is not a UUID is refused before any query is built from it.
  it.each(['no-such-course', '', `${COURSE},id.neq.x`])(
    'refuses the ID %j without asking the database',
    async (id) => {
      const { service, queries } = setup()

      await expect(service.getCourse(id)).rejects.toMatchObject({ kind: 'not_found' })
      expect(queries).toHaveLength(0)
    },
  )

  // Proves a refusal from the database becomes an AppError with a safe message.
  it('turns a refused read into an AppError', async () => {
    const { service } = setup({
      course_student_counts: {
        data: null,
        error: { code: '42501', message: 'permission denied for view course_student_counts' },
      },
    })

    const attempt = service.listMyCourses()

    await expect(attempt).rejects.toMatchObject({
      kind: 'forbidden',
      message: 'You do not have access to this.',
    })
  })

  // SECURITY: proves a course with a status the app does not know is refused, not shown.
  it('refuses a row with an unknown status', async () => {
    const { service } = setup({
      courses: { data: [courseRow({ status: 'sabotaged' })], error: null },
    })

    await expect(service.listMyCourses()).rejects.toMatchObject({ kind: 'unknown' })
  })
})
