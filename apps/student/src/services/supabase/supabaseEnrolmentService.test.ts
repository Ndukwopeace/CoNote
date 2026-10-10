/**
 * Tests for the Supabase enrolment service against a fake client: how standing and requests are
 * put together, which writes are made, and how refusals become the messages pages show.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client, and the helper that checks what was asked.
import { createFakeTables, made, type RecordedQuery, type TableAnswer } from './fakeTables'

// The service under test.
import { createSupabaseEnrolmentService } from './supabaseEnrolmentService'

// Made-up IDs, shaped like the database's.
const OPEN = '20000000-0000-0000-0000-000000000001'
const MINE = '20000000-0000-0000-0000-000000000002'
const UPCOMING = '20000000-0000-0000-0000-000000000003'
const REQUEST = '40000000-0000-0000-0000-000000000001'
const OLDER = '40000000-0000-0000-0000-000000000002'

/** A row of the `joinable_courses` view. */
function joinable(id: string, code: string, membership: string, teacher: string | null = 'Sarah') {
  return {
    id,
    code,
    title: `Title of ${code}`,
    status: 'ongoing',
    teacher_name: teacher,
    membership,
  }
}

/** A row of `enrollment_requests`. */
function request(id: string, courseId: string, status: string, createdAt: string) {
  return { id, course_id: courseId, status, created_at: createdAt }
}

/** Answers per table, and per kind of call on `enrollment_requests`. */
interface Tables {
  joinable_courses: TableAnswer
  // Reading the student's requests (select without a write).
  requestsRead: TableAnswer
  // The answer to an insert.
  requestsInsert: TableAnswer
  // The answer to the cancelling update.
  requestsUpdate: TableAnswer
}

/** Builds the service over a fake client that answers from `tables`. */
function setup(overrides: Partial<Tables> = {}) {
  const tables: Tables = {
    joinable_courses: {
      data: [
        joinable(OPEN, 'MTH 202', 'none'),
        joinable(MINE, 'SWE 311', 'enrolled'),
        joinable(UPCOMING, 'PHY 101', 'none', null),
      ],
      error: null,
    },
    requestsRead: { data: [], error: null },
    requestsInsert: {
      data: request(REQUEST, OPEN, 'pending', '2026-10-10T10:00:00Z'),
      error: null,
    },
    requestsUpdate: { data: [{ id: REQUEST }], error: null },
    ...overrides,
  }
  const { client, queries } = createFakeTables((query: RecordedQuery) => {
    // The view of joinable courses, or the person's own request rows.
    if (query.table === 'joinable_courses') {
      // A one-row read (`maybeSingle`) picks the row with the ID it was asked for, as the
      // database would; a list read gets every row.
      if (!query.calls.some(([method]) => method === 'maybeSingle')) return tables.joinable_courses
      const wanted = query.calls.find(([method, column]) => method === 'eq' && column === 'id')
      const rows = tables.joinable_courses.data as { id: string }[]
      return {
        data: rows.find((row) => row.id === wanted?.[2]) ?? null,
        error: tables.joinable_courses.error,
      }
    }
    if (query.table !== 'enrollment_requests') throw new Error(`Unexpected table ${query.table}`)
    // Which kind of call this was decides the answer.
    if (query.calls.some(([method]) => method === 'insert')) return tables.requestsInsert
    if (query.calls.some(([method]) => method === 'update')) return tables.requestsUpdate
    return tables.requestsRead
  })
  return { service: createSupabaseEnrolmentService({ client }), queries }
}

describe('Supabase enrolment service: listing courses', () => {
  // Proves every course in use is listed, with the teacher's name and a fallback for none.
  it('lists the courses with their standing', async () => {
    const { service } = setup()

    const courses = await service.listJoinableCourses()

    expect(courses).toEqual([
      {
        id: OPEN,
        code: 'MTH 202',
        title: 'Title of MTH 202',
        teacherName: 'Sarah',
        status: 'ongoing',
        membership: 'none',
        requestId: null,
      },
      expect.objectContaining({ id: MINE, membership: 'enrolled', requestId: null }),
      expect.objectContaining({ id: UPCOMING, teacherName: 'Not assigned yet' }),
    ])
  })

  // Proves a waiting request supplies its ID, and a declined one is shown as declined.
  it('shows a pending request’s ID and a declined standing', async () => {
    const { service } = setup({
      joinable_courses: {
        data: [joinable(OPEN, 'MTH 202', 'pending'), joinable(UPCOMING, 'PHY 101', 'none')],
        error: null,
      },
      requestsRead: {
        data: [
          request(REQUEST, OPEN, 'pending', '2026-10-10T10:00:00Z'),
          request(OLDER, UPCOMING, 'declined', '2026-10-09T10:00:00Z'),
        ],
        error: null,
      },
    })

    const courses = await service.listJoinableCourses()

    expect(courses.find((c) => c.id === OPEN)).toMatchObject({
      membership: 'pending',
      requestId: REQUEST,
    })
    expect(courses.find((c) => c.id === UPCOMING)).toMatchObject({
      membership: 'declined',
      requestId: null,
    })
  })

  // Proves only the latest request counts: an old decline does not hide a newer cancellation.
  it('uses the latest request for each course', async () => {
    const { service } = setup({
      requestsRead: {
        data: [
          request(
            '40000000-0000-0000-0000-000000000009',
            OPEN,
            'cancelled',
            '2026-10-10T10:00:00Z',
          ),
          request(OLDER, OPEN, 'declined', '2026-10-09T10:00:00Z'),
        ],
        error: null,
      },
    })

    const courses = await service.listJoinableCourses()

    expect(courses.find((c) => c.id === OPEN)).toMatchObject({ membership: 'none' })
  })

  // Proves the search matches code or title in any letter case, and a blank search lists all.
  it('searches by code or title', async () => {
    const { service } = setup()

    expect((await service.listJoinableCourses(' mth ')).map((c) => c.id)).toEqual([OPEN])
    expect((await service.listJoinableCourses('TITLE OF SWE')).map((c) => c.id)).toEqual([MINE])
    await expect(service.listJoinableCourses('zzz')).resolves.toEqual([])
    await expect(service.listJoinableCourses('   ')).resolves.toHaveLength(3)
  })

  // SECURITY: proves search text never reaches the database, where it could be read as a filter.
  it('keeps the search text out of the query', async () => {
    const { service, queries } = setup()

    await service.listJoinableCourses('x),id.neq.0,(y')

    expect(JSON.stringify(queries)).not.toContain('id.neq.0')
  })

  // Proves a view row with an unknown standing is refused.
  it('refuses a row with an unknown standing', async () => {
    const { service } = setup({
      joinable_courses: { data: [joinable(OPEN, 'MTH 202', 'god-mode')], error: null },
    })

    await expect(service.listJoinableCourses()).rejects.toMatchObject({ kind: 'unknown' })
  })
})

describe('Supabase enrolment service: requests', () => {
  // Proves pending and declined requests are listed newest first, with the course's code and title.
  it('lists pending and declined requests with their course', async () => {
    const { service } = setup({
      requestsRead: {
        data: [
          request(REQUEST, OPEN, 'pending', '2026-10-10T10:00:00Z'),
          request(OLDER, UPCOMING, 'declined', '2026-10-09T10:00:00Z'),
          request('40000000-0000-0000-0000-000000000003', MINE, 'approved', '2026-10-08T10:00:00Z'),
          request('40000000-0000-0000-0000-000000000004', OPEN, 'declined', '2026-10-07T10:00:00Z'),
        ],
        error: null,
      },
    })

    const requests = await service.listMyJoinRequests()

    // Newest first; the approved one and the older decline for OPEN are not shown.
    expect(requests).toEqual([
      {
        id: REQUEST,
        courseId: OPEN,
        courseCode: 'MTH 202',
        courseTitle: 'Title of MTH 202',
        status: 'pending',
        createdAt: '2026-10-10T10:00:00Z',
      },
      expect.objectContaining({ id: OLDER, courseCode: 'PHY 101', status: 'declined' }),
    ])
  })

  // Proves a request for a course that is no longer open is left out, since it cannot be shown.
  it('leaves out a request for a course no longer open', async () => {
    const { service } = setup({
      requestsRead: {
        data: [
          request(
            REQUEST,
            '20000000-0000-0000-0000-0000000000ff',
            'pending',
            '2026-10-10T10:00:00Z',
          ),
        ],
        error: null,
      },
    })

    await expect(service.listMyJoinRequests()).resolves.toEqual([])
  })

  // Proves a request asks for the course only, and returns the new request.
  it('asks to join a course', async () => {
    const { service, queries } = setup()

    const created = await service.requestToJoin(OPEN)

    expect(created).toEqual({
      id: REQUEST,
      courseId: OPEN,
      courseCode: 'MTH 202',
      courseTitle: 'Title of MTH 202',
      status: 'pending',
      createdAt: '2026-10-10T10:00:00Z',
    })
    // SECURITY: the browser sends the course and nothing else; the student is set by the database.
    const write = queries.find((query) => query.calls.some(([method]) => method === 'insert'))
    expect(write?.calls.find(([method]) => method === 'insert')?.[1]).toEqual({ course_id: OPEN })
  })

  // Proves a course that is not open, or not known, gets the same refusal.
  it.each(['no-such-course', '20000000-0000-0000-0000-0000000000ff'])(
    'says a request for %s is not open',
    async (courseId) => {
      const { service } = setup()

      await expect(service.requestToJoin(courseId)).rejects.toMatchObject({
        kind: 'validation',
        message: "This course isn't open for requests.",
      })
    },
  )

  // Proves a course the student is in, or has asked for, is a conflict with its own message.
  it('refuses a request for a course already joined or already asked for', async () => {
    const joined = setup()
    await expect(joined.service.requestToJoin(MINE)).rejects.toMatchObject({
      kind: 'conflict',
      message: "You're already in this course.",
    })

    const waiting = setup({
      joinable_courses: { data: [joinable(OPEN, 'MTH 202', 'pending')], error: null },
    })
    await expect(waiting.service.requestToJoin(OPEN)).rejects.toMatchObject({
      kind: 'conflict',
      message: "You've already asked to join this course.",
    })
  })

  // Proves a race is handled: another tab asked first, or the course closed a moment ago.
  it('handles the database refusing the request', async () => {
    const duplicate = setup({
      requestsInsert: { data: null, error: { code: '23505', message: 'duplicate key' } },
    })
    await expect(duplicate.service.requestToJoin(OPEN)).rejects.toMatchObject({
      kind: 'conflict',
      message: "You've already asked to join this course.",
    })

    const closed = setup({
      requestsInsert: { data: null, error: { code: '42501', message: 'row-level security' } },
    })
    await expect(closed.service.requestToJoin(OPEN)).rejects.toMatchObject({
      kind: 'validation',
      message: "This course isn't open for requests.",
    })
  })

  // Proves cancelling changes only a pending request.
  it('cancels a pending request', async () => {
    const { service, queries } = setup()

    await expect(service.cancelJoinRequest(REQUEST)).resolves.toBeUndefined()

    const write = queries.find((query) => query.calls.some(([method]) => method === 'update'))
    expect(write && made(write, 'update', { status: 'cancelled' })).toBe(true)
    expect(write && made(write, 'eq', 'id', REQUEST)).toBe(true)
    expect(write && made(write, 'eq', 'status', 'pending')).toBe(true)
  })

  // Proves a request that was already decided is a conflict, and an unknown one is not_found.
  it('tells a decided request from an unknown one', async () => {
    const decided = setup({
      requestsUpdate: { data: [], error: null },
      requestsRead: { data: { id: REQUEST, status: 'approved' }, error: null },
    })
    await expect(decided.service.cancelJoinRequest(REQUEST)).rejects.toMatchObject({
      kind: 'conflict',
      message: 'This request has already been decided.',
    })

    const unknown = setup({
      requestsUpdate: { data: [], error: null },
      requestsRead: { data: null, error: null },
    })
    await expect(unknown.service.cancelJoinRequest(REQUEST)).rejects.toMatchObject({
      kind: 'not_found',
    })
  })

  // SECURITY: proves a request ID that is not a UUID never reaches a query.
  it('refuses a request ID that is not a UUID', async () => {
    const { service, queries } = setup()

    await expect(service.cancelJoinRequest('no-such-request')).rejects.toMatchObject({
      kind: 'not_found',
    })
    expect(queries).toHaveLength(0)
  })

  // Proves a refused read is an AppError with a safe message.
  it('turns a refused read into an AppError', async () => {
    const { service } = setup({
      joinable_courses: { data: null, error: { code: '42501', message: 'permission denied' } },
    })

    await expect(service.listJoinableCourses()).rejects.toMatchObject({ kind: 'forbidden' })
  })
})
