/**
 * Tests for the Supabase course service's own logic, against a fake client: which queries it makes,
 * how it keeps a search from adding conditions, and how it words each refusal. The real database
 * is covered by the integration contract run (supabaseCourseService.integration.test.ts).
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

// The service under test.
import { createSupabaseCourseService } from './supabaseCourseService'

// IDs the tests use.
const COURSE = '20000000-0000-4000-8000-000000000001'
const TEACHER = '10000000-0000-4000-8000-000000000002'
const STUDENT = '10000000-0000-4000-8000-000000000003'
const ADMIN = '10000000-0000-4000-8000-000000000001'
const REQUEST = '30000000-0000-4000-8000-000000000004'

/** A course as the list view returns it. */
function courseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COURSE,
    code: 'MTH 202',
    title: 'Linear Algebra',
    description: 'Vectors.',
    department: 'Mathematics',
    status: 'ongoing',
    created_at: '2026-09-01T09:00:00.000Z',
    archived_at: null,
    teacher_id: TEACHER,
    teacher_name: 'Dr. Smith',
    student_count: 3,
    class_count: 2,
    pending_request_count: 1,
    ...overrides,
  }
}

/** A refused call, as PostgREST reports it. */
const refusal = (code: string, message = 'raw') => ({ data: null, error: { code, message } })

/** A service whose queries are answered by `answer`. */
function setup(answer: (query: RecordedQuery) => TableAnswer) {
  const { client, queries } = createFakeTables(answer, { userId: ADMIN })
  const now = () => new Date('2026-10-08T12:00:00.000Z')
  return { service: createSupabaseCourseService({ client, now }), queries }
}

/** The valid course form the tests send. */
const FORM = {
  code: 'mth202',
  title: ' Linear Algebra ',
  description: '',
  department: 'Mathematics',
  status: 'ongoing' as const,
  teacherId: null,
}

describe('listCourses', () => {
  // Proves the list asks for the count first and then for one page, in the sort order asked.
  it('counts, then reads one page in order', async () => {
    const { service, queries } = setup((query) =>
      made(query, 'select', 'id', { count: 'exact', head: true })
        ? { data: null, error: null, count: 45 }
        : { data: [courseRow()], error: null },
    )
    const page = await service.listCourses({ page: 2, sort: '-students' })
    expect(page).toMatchObject({ total: 45, page: 2, pageSize: 20 })
    expect(page.items[0]).toMatchObject({
      code: 'MTH 202',
      teacher: { id: TEACHER, fullName: 'Dr. Smith' },
      studentCount: 3,
      pendingRequestCount: 1,
    })
    const read = queries[1]!
    expect(made(read, 'order', 'student_count', { ascending: false })).toBe(true)
    // Ties fall back to the code.
    expect(made(read, 'order', 'code')).toBe(true)
    expect(made(read, 'range', 20, 39)).toBe(true)
  })

  // Proves a page past the end shows the last page.
  it('shows the last page when the page is past the end', async () => {
    const { service, queries } = setup((query) =>
      made(query, 'select', 'id', { count: 'exact', head: true })
        ? { data: null, error: null, count: 23 }
        : { data: [courseRow()], error: null },
    )
    const page = await service.listCourses({ page: 9 })
    expect(page.page).toBe(2)
    expect(made(queries[1]!, 'range', 20, 39)).toBe(true)
  })

  // Proves an empty list makes no second request.
  it('reads nothing when nothing matches', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null, count: 0 }))
    await expect(service.listCourses({})).resolves.toMatchObject({ items: [], total: 0, page: 1 })
    expect(queries).toHaveLength(1)
  })

  // SECURITY: proves a search cannot add conditions of its own to the filter.
  it('keeps filter characters in a search out of the query', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null, count: 0 }))
    await service.listCourses({ q: 'x),status.eq.completed,(title.ilike.%' })
    const search = queries[0]!.calls.find((call) => call[0] === 'or')
    expect(search?.[1]).toBe(
      'code.ilike.%x  status.eq.completed  title.ilike.%,title.ilike.%x  status.eq.completed  title.ilike.%',
    )
  })

  // Proves the filters become the matching conditions.
  it('filters by status, department, requests and archive state', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null, count: 0 }))
    await service.listCourses({
      status: 'upcoming',
      department: 'English',
      requests: 'waiting',
      archived: true,
    })
    const query = queries[0]!
    expect(made(query, 'not', 'archived_at', 'is', null)).toBe(true)
    expect(made(query, 'eq', 'status', 'upcoming')).toBe(true)
    expect(made(query, 'eq', 'department', 'English')).toBe(true)
    expect(made(query, 'gt', 'pending_request_count', 0)).toBe(true)
  })

  // Proves a refused read becomes an AppError.
  it('reports a refused read', async () => {
    const { service } = setup(() => refusal('42501'))
    await expect(service.listCourses({})).rejects.toMatchObject({ kind: 'forbidden' })
  })
})

describe('getCourse', () => {
  // SECURITY: proves an ID that is not a UUID never reaches a query.
  it('does not query for an ID that is not a UUID', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null }))
    await expect(service.getCourse('nope')).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries).toHaveLength(0)
  })

  // Proves an unknown course is not found.
  it('rejects an unknown course', async () => {
    const { service } = setup(() => ({ data: null, error: null }))
    await expect(service.getCourse(COURSE)).rejects.toMatchObject({
      kind: 'not_found',
      message: 'Course not found.',
    })
  })

  // Proves the details combine the course, its classes with their stages, and its resources.
  it('returns the course with classes, stages and resources', async () => {
    const { service } = setup((query) => {
      if (query.table === 'admin_courses') return { data: courseRow(), error: null }
      if (query.table === 'class_sessions') {
        return {
          data: [
            {
              id: 'k1',
              title: 'Vectors',
              starts_at: '2026-09-10T09:00:00.000Z',
              archived_at: null,
            },
            { id: 'k2', title: 'Spaces', starts_at: '2026-09-17T09:00:00.000Z', archived_at: null },
            {
              id: 'k3',
              title: 'Cancelled',
              starts_at: '2026-09-24T09:00:00.000Z',
              archived_at: 'x',
            },
          ],
          error: null,
        }
      }
      if (query.table === 'summary_monitor') {
        return {
          data: [
            { class_id: 'k1', status: 'published' },
            { class_id: 'k2', status: 'failed' },
          ],
          error: null,
        }
      }
      return {
        data: [
          { id: 'r1', title: 'Outline', type: 'pdf', status: 'published', class: null },
          {
            id: 'r2',
            title: 'Slides',
            type: 'slides',
            status: 'draft',
            class: { title: 'Vectors' },
          },
        ],
        error: null,
      }
    })
    const course = await service.getCourse(COURSE)
    expect(course).toMatchObject({ code: 'MTH 202', publishedSummaryCount: 1 })
    expect(course.classes.map((item) => [item.title, item.summaryStatus, item.archived])).toEqual([
      ['Vectors', 'published', false],
      // A failed run is shown as still processing.
      ['Spaces', 'processing', false],
      ['Cancelled', null, true],
    ])
    expect(course.resources.map((item) => item.classTitle)).toEqual([null, 'Vectors'])
  })
})

describe('createCourse', () => {
  // Proves the form rules run in the service, before any request.
  it('validates before writing', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null }))
    await expect(service.createCourse({ ...FORM, title: '' })).rejects.toMatchObject({
      kind: 'validation',
      message: 'Enter a title.',
    })
    expect(queries).toHaveLength(0)
  })

  // Proves the code is stored tidily and the teacher goes in as the teacher column.
  it('stores the tidied course', async () => {
    const { service, queries } = setup((query) => {
      if (query.table === 'courses') return { data: { id: COURSE }, error: null }
      if (query.table === 'admin_courses') return { data: courseRow(), error: null }
      return { data: [], error: null }
    })
    await service.createCourse({ ...FORM, teacherId: TEACHER })
    const insert = queries[0]!.calls.find((call) => call[0] === 'insert')
    expect(insert?.[1]).toMatchObject({
      code: 'MTH 202',
      title: 'Linear Algebra',
      teacher_id: TEACHER,
    })
  })

  // Proves a taken code reads as a conflict.
  it('reports a code that is already taken', async () => {
    const { service } = setup(() => refusal('23505'))
    await expect(service.createCourse(FORM)).rejects.toMatchObject({
      kind: 'conflict',
      message: 'A course with this code already exists.',
    })
  })

  // Proves a teacher the database refuses reads as the form message.
  it('reports a teacher who is not active', async () => {
    const { service } = setup(() => refusal('23514'))
    await expect(service.createCourse({ ...FORM, teacherId: TEACHER })).rejects.toMatchObject({
      kind: 'validation',
      message: 'Choose an active teacher.',
    })
  })

  // SECURITY: proves a teacher ID that is not a UUID never reaches a query.
  it('refuses a teacher ID that is not a UUID', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null }))
    await expect(service.createCourse({ ...FORM, teacherId: 'x' })).rejects.toMatchObject({
      message: 'Choose an active teacher.',
    })
    expect(queries).toHaveLength(0)
  })
})

describe('signing in', () => {
  // SECURITY: proves no change is attempted without a session.
  it('refuses every change when nobody is signed in', async () => {
    const { client, queries } = createFakeTables(() => ({ data: null, error: null }))
    const service = createSupabaseCourseService({ client })
    await expect(service.createCourse(FORM)).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.archiveCourse(COURSE)).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.decideEnrollmentRequest(REQUEST, 'approved')).rejects.toMatchObject({
      kind: 'unauthorized',
    })
    expect(queries).toHaveLength(0)
  })
})

describe('changes to a course', () => {
  /** A service over a course that is archived or not. */
  function over(archivedAt: string | null) {
    return setup((query) =>
      query.table === 'admin_courses'
        ? { data: courseRow({ archived_at: archivedAt }), error: null }
        : { data: [], error: null },
    )
  }

  // Proves an archived course refuses every change, with the same message.
  it.each([
    ['updateCourse', (s: ReturnType<typeof over>['service']) => s.updateCourse(COURSE, FORM)],
    ['assignTeacher', (s: ReturnType<typeof over>['service']) => s.assignTeacher(COURSE, TEACHER)],
    ['removeTeacher', (s: ReturnType<typeof over>['service']) => s.removeTeacher(COURSE)],
    [
      'enrollStudents',
      (s: ReturnType<typeof over>['service']) => s.enrollStudents(COURSE, [STUDENT]),
    ],
    ['removeStudent', (s: ReturnType<typeof over>['service']) => s.removeStudent(COURSE, STUDENT)],
  ])('%s refuses an archived course', async (_name, act) => {
    const { service, queries } = over('2026-09-01T09:00:00.000Z')
    await expect(act(service)).rejects.toMatchObject({
      message: 'This course is archived. Restore it to make changes.',
    })
    // Only the read of the course; nothing was written.
    expect(
      queries.filter((query) =>
        query.calls.some(
          (call) => call[0] !== 'select' && call[0] !== 'eq' && call[0] !== 'maybeSingle',
        ),
      ),
    ).toHaveLength(0)
  })

  // Proves archiving and restoring check the current state.
  it('refuses archiving an archived course and restoring one in use', async () => {
    await expect(over('x').service.archiveCourse(COURSE)).rejects.toMatchObject({
      message: 'This course is already archived.',
    })
    await expect(over(null).service.restoreCourse(COURSE)).rejects.toMatchObject({
      message: 'This course is not archived.',
    })
  })

  // Proves archiving stamps the time from the clock.
  it('archives with the clock’s time', async () => {
    const { service, queries } = over(null)
    await service.archiveCourse(COURSE)
    const update = queries.find((query) => query.table === 'courses')!
    expect(made(update, 'update', { archived_at: '2026-10-08T12:00:00.000Z' })).toBe(true)
  })

  // Proves times come back as ISO text however the database wrote them.
  it('returns times as ISO text', async () => {
    const { service } = setup((query) =>
      query.table === 'admin_courses'
        ? { data: courseRow({ created_at: '2026-09-01T09:00:00+00:00' }), error: null }
        : { data: [], error: null },
    )
    await expect(service.getCourse(COURSE)).resolves.toMatchObject({
      createdAt: '2026-09-01T09:00:00.000Z',
    })
  })

  // Proves removing a teacher from a course without one changes nothing.
  it('does not write when there is no teacher to remove', async () => {
    const { service, queries } = setup((query) =>
      query.table === 'admin_courses'
        ? { data: courseRow({ teacher_id: null, teacher_name: null }), error: null }
        : { data: [], error: null },
    )
    await service.removeTeacher(COURSE)
    expect(queries.some((query) => query.table === 'courses')).toBe(false)
  })

  // Proves assigning a teacher is one update of the teacher column.
  it('assigns a teacher', async () => {
    const { service, queries } = over(null)
    await service.assignTeacher(COURSE, TEACHER)
    const update = queries.find((query) => query.table === 'courses')!
    expect(made(update, 'update', { teacher_id: TEACHER })).toBe(true)
    expect(made(update, 'eq', 'id', COURSE)).toBe(true)
  })
})

describe('students', () => {
  /** A service over a course in use, whose other tables answer through `answers`. */
  function over(answers: Record<string, TableAnswer>) {
    return setup(
      (query) =>
        answers[query.table] ??
        (query.table === 'admin_courses'
          ? { data: courseRow(), error: null }
          : { data: [], error: null }),
    )
  }

  // Proves the students are searched by name, email and number and listed A to Z.
  it('lists and searches a course’s students', async () => {
    const people = [
      { id: 's2', full_name: 'Zed', email: 'zed@x.test', student_number: 'U1', status: 'active' },
      { id: 's1', full_name: 'Ada', email: 'ada@x.test', student_number: null, status: 'active' },
    ]
    const { service } = over({
      enrollments: { data: people.map((student) => ({ student })), error: null },
    })
    expect((await service.listEnrollments(COURSE)).map((s) => s.fullName)).toEqual(['Ada', 'Zed'])
    expect((await service.listEnrollments(COURSE, 'u1')).map((s) => s.fullName)).toEqual(['Zed'])
  })

  // Proves the bulk preview sorts every kind of value, in any letter case.
  it('previews a bulk enrolment', async () => {
    const person = (
      id: string,
      email: string,
      role: string,
      status: string,
      number: string | null,
    ) => ({
      id,
      full_name: id,
      email,
      student_number: number,
      role,
      status,
    })
    const { service } = over({
      'rpc:admin_match_people': {
        data: [
          person('a', 'a@x.test', 'student', 'active', 'U1'),
          person('b', 'b@x.test', 'student', 'active', null),
          person('t', 't@x.test', 'teacher', 'active', null),
          person('s', 's@x.test', 'student', 'suspended', null),
        ],
        error: null,
      },
      enrollments: { data: [{ student_id: 'b' }], error: null },
    })
    const match = await service.matchStudents(COURSE, [
      'A@X.TEST',
      'u1',
      'b@x.test',
      't@x.test',
      's@x.test',
      'nobody@x.test',
    ])
    expect(match.matched.map((s) => s.id)).toEqual(['a'])
    expect(match.alreadyEnrolled.map((s) => s.id)).toEqual(['b'])
    expect(match.unmatched).toEqual([
      { value: 't@x.test', reason: 'not_a_student' },
      { value: 's@x.test', reason: 'not_active' },
      { value: 'nobody@x.test', reason: 'not_found' },
    ])
  })

  // Proves an empty paste makes no lookup.
  it('looks nobody up for an empty list', async () => {
    const { service, queries } = over({})
    await service.matchStudents(COURSE, ['  ', ''])
    expect(queries.some((query) => query.table.startsWith('rpc:'))).toBe(false)
  })

  // SECURITY: proves only valid IDs of active students are enrolled, each once.
  it('enrols only the eligible students', async () => {
    const { service, queries } = over({
      profiles: { data: [{ id: STUDENT }], error: null },
      enrollments: { data: [{ student_id: STUDENT }], error: null },
    })
    await expect(service.enrollStudents(COURSE, [STUDENT, STUDENT, 'not-a-uuid'])).resolves.toEqual(
      {
        added: 1,
      },
    )
    const lookup = queries.find((query) => query.table === 'profiles')!
    expect(made(lookup, 'in', 'id', [STUDENT])).toBe(true)
    expect(made(lookup, 'eq', 'role', 'student')).toBe(true)
    expect(made(lookup, 'eq', 'status', 'active')).toBe(true)
  })

  // Proves nobody eligible means nothing is written.
  it('adds nobody when nobody is eligible', async () => {
    const { service, queries } = over({ profiles: { data: [], error: null } })
    await expect(service.enrollStudents(COURSE, [STUDENT])).resolves.toEqual({ added: 0 })
    await expect(service.enrollStudents(COURSE, ['x'])).resolves.toEqual({ added: 0 })
    expect(queries.some((query) => query.table === 'enrollments')).toBe(false)
  })

  // Proves removing someone who is not in the course is not found.
  it('rejects removing a student who is not in the course', async () => {
    const { service } = over({ enrollments: { data: [], error: null } })
    await expect(service.removeStudent(COURSE, STUDENT)).rejects.toMatchObject({
      kind: 'not_found',
      message: 'This student isn’t in the course.',
    })
    await expect(service.removeStudent(COURSE, 'x')).rejects.toMatchObject({ kind: 'not_found' })
  })
})

describe('requests to join', () => {
  // Proves the waiting requests are listed with the student who asked.
  it('lists the waiting requests', async () => {
    const { service, queries } = setup((query) => {
      if (query.table === 'admin_courses') return { data: courseRow(), error: null }
      return {
        data: [
          {
            id: REQUEST,
            created_at: '2026-10-01T09:00:00.000Z',
            student: {
              id: STUDENT,
              full_name: 'Ada',
              email: 'ada@x.test',
              student_number: null,
              status: 'active',
            },
          },
        ],
        error: null,
      }
    })
    const [request] = await service.listEnrollmentRequests(COURSE)
    expect(request).toMatchObject({ id: REQUEST, requestedAt: '2026-10-01T09:00:00.000Z' })
    expect(request?.student.fullName).toBe('Ada')
    const read = queries.find((query) => query.table === 'enrollment_requests')!
    expect(made(read, 'eq', 'status', 'pending')).toBe(true)
  })

  // Proves a decision is one call to the database function, with the caller's choice.
  it('decides through the database function', async () => {
    const { service, queries } = setup(() => ({ data: {}, error: null }))
    await service.decideEnrollmentRequest(REQUEST, 'approved')
    expect(queries[0]).toMatchObject({ table: 'rpc:decide_enrollment_request' })
    expect(made(queries[0]!, 'rpc', { p_request: REQUEST, p_decision: 'approved' })).toBe(true)
  })

  // SECURITY: proves an ID that is not a UUID never reaches the function.
  it('does not call the function for an ID that is not a UUID', async () => {
    const { service, queries } = setup(() => ({ data: {}, error: null }))
    await expect(service.decideEnrollmentRequest('x', 'declined')).rejects.toMatchObject({
      kind: 'not_found',
      message: 'Request not found.',
    })
    expect(queries).toHaveLength(0)
  })

  // Proves each refusal from the function reads as the message the screen shows.
  it.each([
    ['P0002', 'not found', 'not_found', 'Request not found.'],
    ['23505', 'already decided', 'conflict', 'This request has already been decided.'],
    [
      '23514',
      'course archived',
      'validation',
      'This course is archived. Restore it to make changes.',
    ],
    ['22023', 'account cannot be enrolled', 'validation', "This account can't be enrolled."],
    ['42501', 'forbidden', 'forbidden', 'You do not have access to this.'],
  ])('maps %s (%s)', async (code, message, kind, expected) => {
    const { service } = setup(() => refusal(code, message))
    await expect(service.decideEnrollmentRequest(REQUEST, 'approved')).rejects.toMatchObject({
      kind,
      message: expected,
    })
  })
})

describe('listCourseFilterOptions', () => {
  // Proves the departments and active teachers are listed A to Z.
  it('offers departments and active teachers A to Z', async () => {
    const { service, queries } = setup((query) =>
      query.table === 'admin_departments'
        ? { data: [{ department: 'English' }, { department: 'Biology' }], error: null }
        : {
            data: [
              { id: 't2', full_name: 'Zed', department: null },
              { id: 't1', full_name: 'Ada', department: 'English' },
            ],
            error: null,
          },
    )
    const options = await service.listCourseFilterOptions()
    expect(options.departments).toEqual(['Biology', 'English'])
    expect(options.teachers.map((teacher) => teacher.fullName)).toEqual(['Ada', 'Zed'])
    const teachers = queries.find((query) => query.table === 'profiles')!
    expect(made(teachers, 'eq', 'role', 'teacher')).toBe(true)
    expect(made(teachers, 'eq', 'status', 'active')).toBe(true)
  })
})
