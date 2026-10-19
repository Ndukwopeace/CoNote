/**
 * Tests for the demo enrolment service: the shared contract, plus how the demo keeps its state.
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// The shared contract and its fixture IDs.
import { FIXTURE, runEnrolmentServiceContract } from '../contracts/enrolmentService.contract'
import { runProgrammeContract } from '../contracts/programmeEnrolment.contract'

// The unit under test.
import {
  createMockEnrolment,
  MOCK_ENROLMENT_KEY,
  startNewStudent,
  type CatalogCourse,
  type CatalogProgramme,
} from './mockEnrolment'

/** The platform's courses for the tests. */
const CATALOG: CatalogCourse[] = [
  course(FIXTURE.open, 'MTH 202', 'Linear Algebra', 'ongoing'),
  course(FIXTURE.upcoming, 'PHY 101', 'General Physics', 'upcoming'),
  course(FIXTURE.completed, 'MTH 101', 'Calculus I', 'completed'),
  { ...course(FIXTURE.archived, 'OLD 100', 'Old Course', 'ongoing'), archived: true },
  course(FIXTURE.enrolled, 'SWE 311', 'Software Engineering', 'ongoing'),
]

/** The platform's programmes for the tests. */
const PROGRAMMES: CatalogProgramme[] = [
  {
    id: 'prog-open',
    code: 'SWE-Y3',
    name: 'Software Engineering, Year 3',
    openEnrolment: true,
    archived: false,
    // In use, in use, in use (already in), completed, archived.
    courseIds: [
      FIXTURE.open,
      FIXTURE.upcoming,
      FIXTURE.enrolled,
      FIXTURE.completed,
      FIXTURE.archived,
    ],
  },
  {
    id: 'prog-closed',
    code: 'BMS-Y1',
    name: 'Biomedical Sciences, Year 1',
    openEnrolment: false,
    archived: false,
    courseIds: [FIXTURE.open],
  },
  {
    id: 'prog-archived',
    code: 'OLD-Y1',
    name: 'Old programme',
    openEnrolment: true,
    archived: true,
    courseIds: [FIXTURE.open],
  },
]

/** A catalog course that is not archived. */
function course(
  id: string,
  code: string,
  title: string,
  status: CatalogCourse['status'],
): CatalogCourse {
  return { id, code, title, teacherName: 'Dr. Teacher', status, archived: false }
}

/** A fresh demo enrolment over the fixture, in memory, with no delay. */
function create(store?: Storage) {
  return createMockEnrolment({
    catalog: CATALOG,
    programmes: PROGRAMMES,
    initialEnrolledIds: [FIXTURE.enrolled],
    latencyMs: 0,
    ...(store ? { store } : {}),
  })
}

runEnrolmentServiceContract('mock', {
  create: () => {
    const { service, decide } = create()
    return { service, decide }
  },
})

runProgrammeContract('mock', {
  fixture: {
    open: 'prog-open',
    closed: 'prog-closed',
    archived: 'prog-archived',
    // MTH 202, PHY 101 and SWE 311 are in use.
    openCodes: ['MTH 202', 'PHY 101', 'SWE 311'],
    newCourses: [FIXTURE.open, FIXTURE.upcoming],
    completedCourse: FIXTURE.completed,
    archivedCourse: FIXTURE.archived,
  },
  create: () => ({ service: create().service }),
})

describe('mock enrolment', () => {
  // Start every test with empty storage.
  beforeEach(() => {
    window.localStorage.clear()
  })

  // Proves state kept in storage survives a new service, as a reload would.
  it('keeps requests across services when it has a store', async () => {
    const first = create(window.localStorage)
    const request = await first.service.requestToJoin(FIXTURE.open)

    const second = create(window.localStorage)

    await expect(second.service.listMyJoinRequests()).resolves.toEqual([request])
  })

  // Proves a joined programme and its courses survive a new service, as a reload would, and an
  // approved request does not forget the programme.
  it('keeps a joined programme across services', async () => {
    const first = create(window.localStorage)
    await first.service.joinProgramme('prog-open')
    const request = await first.service.requestToJoin(FIXTURE.completed).catch(() => null)
    expect(request).toBeNull()

    const second = create(window.localStorage)

    expect([...second.enrolledIds()].sort()).toEqual(
      [FIXTURE.enrolled, FIXTURE.open, FIXTURE.upcoming].sort(),
    )
    const programmes = await second.service.listJoinableProgrammes()
    expect(programmes.find((programme) => programme.id === 'prog-open')?.isMine).toBe(true)
  })

  // Proves a new student has joined no programme.
  it('starts a new student with no programme', async () => {
    const enrolment = create(window.localStorage)
    await enrolment.service.joinProgramme('prog-open')

    startNewStudent(window.localStorage)

    const programmes = await enrolment.service.listJoinableProgrammes()
    expect(programmes.some((programme) => programme.isMine)).toBe(false)
  })

  // Proves signing up starts a student in no courses, even in services made earlier.
  it('starts a new student in no courses', async () => {
    const enrolment = create(window.localStorage)
    expect([...enrolment.enrolledIds()]).toEqual([FIXTURE.enrolled])

    startNewStudent(window.localStorage)

    expect([...enrolment.enrolledIds()]).toEqual([])
    await expect(enrolment.service.listMyJoinRequests()).resolves.toEqual([])
  })

  // SECURITY: stored text that doesn't match the expected shape, or isn't JSON, is thrown away
  // and the initial state is used, so editing storage can't enrol the student in a course.
  it.each([
    ['not JSON', '{nope'],
    ['the wrong shape', JSON.stringify({ enrolledCourseIds: 'all', requests: [] })],
    [
      'a wrong status',
      JSON.stringify({
        enrolledCourseIds: [],
        requests: [{ id: 'r', courseId: FIXTURE.open, status: 'enrolled', createdAt: 'x' }],
      }),
    ],
  ])('ignores stored state that is %s', (_name, raw) => {
    window.localStorage.setItem(MOCK_ENROLMENT_KEY, raw)

    expect([...create(window.localStorage).enrolledIds()]).toEqual([FIXTURE.enrolled])
  })

  // Proves a request is decided once: a second decision is refused.
  it('refuses a second decision on the same request', async () => {
    const { service, decide } = create()
    const request = await service.requestToJoin(FIXTURE.open)
    await decide(request.id, 'approved')

    await expect(decide(request.id, 'declined')).rejects.toMatchObject({ kind: 'conflict' })
    await expect(decide('no-such-request', 'approved')).rejects.toMatchObject({ kind: 'conflict' })
  })
})
