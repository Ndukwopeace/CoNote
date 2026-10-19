/**
 * Tests for the Supabase programme service's own logic, against a fake client: which queries it
 * makes, how it words each refusal, and that it refuses what the database would not answer
 * properly. The real database is covered by the SQL tests and the integration contract run
 * (supabaseProgrammeService.integration.test.ts).
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
import { createSupabaseProgrammeService } from './supabaseProgrammeService'
// The payload it sends.
import type { ImportPayload } from '@/lib/timetable/payload'

// IDs the tests use.
const ADMIN = '10000000-0000-4000-8000-000000000001'
const PROGRAMME = '40000000-0000-4000-8000-000000000001'

/** A programme as the list view returns it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: PROGRAMME,
    code: 'SWE-Y1',
    name: 'Software Engineering · Year 1',
    open_enrolment: true,
    course_count: 7,
    student_count: 12,
    pending_request_count: 3,
    ...overrides,
  }
}

/** A refused call, as PostgREST reports it. */
const refusal = (code: string, message = 'raw') => ({ data: null, error: { code, message } })

/** A service whose queries are answered by `answer`; signed in unless `signedIn` is false. */
function setup(answer: (query: RecordedQuery) => TableAnswer, signedIn = true) {
  const { client, queries } = createFakeTables(answer, signedIn ? { userId: ADMIN } : {})
  return { service: createSupabaseProgrammeService({ client }), queries }
}

/** A small valid import. */
const PAYLOAD: ImportPayload = {
  timezone: 'Africa/Douala',
  programmes: [{ code: 'SWE-Y1', name: 'SWE', courseCodes: ['CSC 101'] }],
  courses: [{ code: 'CSC 101', title: 'Intro', teacherId: null, sessions: [] }],
}

/** What the import function answers with. */
const OUTCOME = {
  programmesCreated: 1,
  programmesExisting: 0,
  coursesCreated: 1,
  coursesExisting: 0,
  classesCreated: 20,
  classesSkipped: 0,
  teachersAssigned: 0,
}

describe('listProgrammes', () => {
  // Proves the list reads the administrator's view in code order and maps the columns.
  it('reads the admin view in code order', async () => {
    const { service, queries } = setup(() => ({
      data: [row({ code: 'bms-y1', id: 'x' }), row()],
      error: null,
    }))

    const items = await service.listProgrammes()

    expect(queries[0]?.table).toBe('admin_programmes')
    expect(made(queries[0]!, 'order', 'code')).toBe(true)
    expect(items.map((item) => item.code)).toEqual(['bms-y1', 'SWE-Y1'])
    expect(items[1]).toEqual({
      id: PROGRAMME,
      code: 'SWE-Y1',
      name: 'Software Engineering · Year 1',
      openEnrolment: true,
      courseCount: 7,
      studentCount: 12,
      pendingRequestCount: 3,
    })
  })

  // SECURITY: proves a row of the wrong shape is refused instead of reaching a screen.
  it('refuses a malformed row', async () => {
    const { service } = setup(() => ({ data: [row({ course_count: 'many' })], error: null }))

    await expect(service.listProgrammes()).rejects.toBeInstanceOf(Error)
  })

  // Proves a refusal becomes a forbidden error.
  it('turns a refusal into a forbidden error', async () => {
    const { service } = setup(() => refusal('42501'))

    await expect(service.listProgrammes()).rejects.toMatchObject({ kind: 'forbidden' })
  })
})

describe('setEnrolmentOpen', () => {
  // Proves it updates the one programme and answers with its fresh row.
  it('updates the programme and returns it', async () => {
    const { service, queries } = setup((query) =>
      query.table === 'programmes'
        ? { data: [{ id: PROGRAMME }], error: null }
        : { data: [row({ open_enrolment: false })], error: null },
    )

    const item = await service.setEnrolmentOpen(PROGRAMME, false)

    const update = queries[0]!
    expect(update.table).toBe('programmes')
    expect(made(update, 'update', { open_enrolment: false })).toBe(true)
    expect(made(update, 'eq', 'id', PROGRAMME)).toBe(true)
    expect(item.openEnrolment).toBe(false)
  })

  // SECURITY: proves an ID that is not a UUID never reaches a query.
  it('turns away an ID that is not a UUID', async () => {
    const { service, queries } = setup(() => ({ data: [], error: null }))

    await expect(service.setEnrolmentOpen('x,id.neq.0', true)).rejects.toMatchObject({
      kind: 'not_found',
    })
    expect(queries).toEqual([])
  })

  // Proves "nothing changed" is a not-found answer, since Row Level Security hides rows silently.
  it('says not found when no row changed', async () => {
    const { service } = setup(() => ({ data: [], error: null }))

    await expect(service.setEnrolmentOpen(PROGRAMME, true)).rejects.toMatchObject({
      kind: 'not_found',
    })
  })

  // Proves nobody signed out can change anything.
  it('refuses a caller who is not signed in', async () => {
    const { service, queries } = setup(() => ({ data: [], error: null }), false)

    await expect(service.setEnrolmentOpen(PROGRAMME, true)).rejects.toMatchObject({
      kind: 'unauthorized',
    })
    expect(queries).toEqual([])
  })
})

describe('importTimetable', () => {
  // Proves the payload and the dry-run flag go to the database function, and its answer comes back.
  it('calls the database function and returns its counts', async () => {
    const { service, queries } = setup(() => ({ data: OUTCOME, error: null }))

    const outcome = await service.importTimetable(PAYLOAD, { dryRun: true })

    expect(queries[0]?.table).toBe('rpc:import_timetable')
    expect(queries[0]?.calls[0]).toEqual(['rpc', { p_payload: PAYLOAD, p_dry_run: true }])
    expect(outcome).toEqual(OUTCOME)
  })

  // Proves a payload the function refuses is explained in its own words.
  it('explains a refused payload', async () => {
    const { service } = setup(() => refusal('22023', 'unknown time zone'))

    await expect(service.importTimetable(PAYLOAD, { dryRun: false })).rejects.toMatchObject({
      kind: 'validation',
      message: "The timetable can't be imported: unknown time zone.",
    })
  })

  // Proves a teacher who cannot teach gets the same message the course form gives.
  it('explains an unusable teacher', async () => {
    const { service } = setup(() => refusal('23514', 'teacher must be active'))

    await expect(service.importTimetable(PAYLOAD, { dryRun: false })).rejects.toMatchObject({
      kind: 'validation',
      message: 'Choose an active teacher.',
    })
  })

  // Proves anyone but an administrator is told they have no access.
  it('turns a forbidden answer into a forbidden error', async () => {
    const { service } = setup(() => refusal('42501'))

    await expect(service.importTimetable(PAYLOAD, { dryRun: false })).rejects.toMatchObject({
      kind: 'forbidden',
    })
  })

  // SECURITY: proves an answer of the wrong shape is refused rather than shown.
  it('refuses an answer of the wrong shape', async () => {
    const { service } = setup(() => ({ data: { coursesCreated: 'lots' }, error: null }))

    await expect(service.importTimetable(PAYLOAD, { dryRun: false })).rejects.toBeInstanceOf(Error)
  })

  // Proves nobody signed out can import.
  it('refuses a caller who is not signed in', async () => {
    const { service, queries } = setup(() => ({ data: OUTCOME, error: null }), false)

    await expect(service.importTimetable(PAYLOAD, { dryRun: false })).rejects.toMatchObject({
      kind: 'unauthorized',
    })
    expect(queries).toEqual([])
  })
})

const REQUEST = '50000000-0000-4000-8000-000000000001'
const STUDENT = '60000000-0000-4000-8000-000000000001'

/** A row of the waiting-requests view. */
function requestView(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST,
    created_at: '2026-10-19T08:00:00Z',
    programme_id: PROGRAMME,
    programme_code: 'SWE-Y1',
    programme_name: 'Software Engineering · Year 1',
    student_id: STUDENT,
    student_name: 'Ada Obi',
    student_email: 'ada@example.com',
    ...overrides,
  }
}

describe('listProgrammeRequests', () => {
  // Proves it reads only the waiting requests, oldest first, and maps the columns.
  it('reads the waiting requests, oldest first', async () => {
    const { service, queries } = setup(() => ({ data: [requestView()], error: null }))

    const items = await service.listProgrammeRequests()

    expect(queries[0]?.table).toBe('admin_programme_requests')
    expect(made(queries[0]!, 'eq', 'status', 'pending')).toBe(true)
    expect(made(queries[0]!, 'order', 'created_at')).toBe(true)
    expect(items).toEqual([
      {
        id: REQUEST,
        programmeId: PROGRAMME,
        programmeCode: 'SWE-Y1',
        programmeName: 'Software Engineering · Year 1',
        studentId: STUDENT,
        studentName: 'Ada Obi',
        studentEmail: 'ada@example.com',
        createdAt: '2026-10-19T08:00:00Z',
      },
    ])
  })

  // SECURITY: proves a row of the wrong shape is refused.
  it('refuses a malformed row', async () => {
    const { service } = setup(() => ({ data: [requestView({ student_name: 7 })], error: null }))

    await expect(service.listProgrammeRequests()).rejects.toBeInstanceOf(Error)
  })
})

describe('decideProgrammeRequest', () => {
  // Proves it calls the database function with the request and the decision.
  it('calls decide_programme_request', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null }))

    await service.decideProgrammeRequest(REQUEST, 'approved')

    expect(queries[0]?.table).toBe('rpc:decide_programme_request')
    expect(queries[0]?.calls).toEqual([['rpc', { p_request: REQUEST, p_decision: 'approved' }]])
  })

  // SECURITY: proves an ID that is not a UUID never reaches the database, and a signed-out caller
  // is turned away.
  it('turns away a bad ID and a signed-out caller', async () => {
    const { service, queries } = setup(() => ({ data: null, error: null }))
    await expect(service.decideProgrammeRequest('x', 'approved')).rejects.toMatchObject({
      kind: 'not_found',
    })
    expect(queries).toEqual([])

    const out = setup(() => ({ data: null, error: null }), false)
    await expect(out.service.decideProgrammeRequest(REQUEST, 'approved')).rejects.toMatchObject({
      kind: 'unauthorized',
    })
  })

  // Proves each refusal reads in words written for people.
  it.each([
    [refusal('P0002').error, 'not_found', 'Request not found.'],
    [
      refusal('23505', 'already decided').error,
      'conflict',
      'This request has already been decided.',
    ],
    [
      refusal('23505', 'already in a programme').error,
      'conflict',
      'This student is already in a programme.',
    ],
    [refusal('23514').error, 'validation', 'This programme is archived.'],
    [refusal('22023').error, 'validation', "This account can't join a programme."],
  ])('words the refusal %j', async (error, kind, message) => {
    const { service } = setup(() => ({ data: null, error }))

    await expect(service.decideProgrammeRequest(REQUEST, 'declined')).rejects.toMatchObject({
      kind,
      message,
    })
  })

  // Proves any other refusal keeps its own kind (a non-administrator is forbidden).
  it('maps other refusals through the shared error mapping', async () => {
    const { service } = setup(() => refusal('42501'))

    await expect(service.decideProgrammeRequest(REQUEST, 'approved')).rejects.toMatchObject({
      kind: 'forbidden',
    })
  })
})

describe('listProgrammeMembers', () => {
  // Proves it reads one programme's members by name.
  it('reads the members of one programme', async () => {
    const { service, queries } = setup(() => ({
      data: [{ student_id: STUDENT, student_name: 'Ada Obi', student_email: 'ada@example.com' }],
      error: null,
    }))

    const members = await service.listProgrammeMembers(PROGRAMME)

    expect(queries[0]?.table).toBe('admin_programme_members')
    expect(made(queries[0]!, 'eq', 'programme_id', PROGRAMME)).toBe(true)
    expect(made(queries[0]!, 'order', 'student_name')).toBe(true)
    expect(members).toEqual([
      { studentId: STUDENT, studentName: 'Ada Obi', studentEmail: 'ada@example.com' },
    ])
  })

  // SECURITY: proves an ID that is not a UUID never reaches a query.
  it('lists nothing for an ID that is not a UUID', async () => {
    const { service, queries } = setup(() => ({ data: [], error: null }))

    await expect(service.listProgrammeMembers('x,id.neq.0')).resolves.toEqual([])
    expect(queries).toEqual([])
  })
})

describe('removeFromProgramme', () => {
  // Proves it calls the database function and returns how many courses the student left.
  it('calls remove_from_programme and returns the count', async () => {
    const { service, queries } = setup(() => ({ data: 4, error: null }))

    await expect(service.removeFromProgramme(STUDENT)).resolves.toBe(4)

    expect(queries[0]?.table).toBe('rpc:remove_from_programme')
    expect(queries[0]?.calls).toEqual([['rpc', { p_student: STUDENT }]])
  })

  // SECURITY: proves a bad ID never reaches the database, and the answer is checked.
  it('turns away a bad ID and a malformed answer', async () => {
    const { service, queries } = setup(() => ({ data: 'four', error: null }))
    await expect(service.removeFromProgramme('x')).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries).toEqual([])

    await expect(service.removeFromProgramme(STUDENT)).rejects.toBeInstanceOf(Error)
  })

  // Proves a student who is not in a programme is not found, and other refusals keep their kind.
  it.each([
    [refusal('P0002').error, 'not_found'],
    [refusal('42501').error, 'forbidden'],
  ])('maps %j to %s', async (error, kind) => {
    const { service } = setup(() => ({ data: null, error }))

    await expect(service.removeFromProgramme(STUDENT)).rejects.toMatchObject({ kind })
  })
})
