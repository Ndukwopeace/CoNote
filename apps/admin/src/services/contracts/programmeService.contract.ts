/**
 * The rules every ProgrammeService must follow (ENGINEERING_STANDARDS.md 2.5), run against each
 * implementation. Each run starts from the same small platform built here.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The data the services read, and the record builders.
import {
  courseRecord,
  emptyPlatformData,
  programmeRecord,
  userRecord,
  type PlatformData,
} from '../platformData'
// The interface under test.
import type { ProgrammeService } from '../types'
// What the import receives.
import type { ImportPayload } from '@/lib/timetable/payload'

/** Builds a service over `data`, with the clock at `now`, acting as administrator `actorId`. */
export type CreateProgrammeService = (
  data: PlatformData,
  now: Date,
  actorId: string,
) => ProgrammeService

/** The contract's clock: inside the timetable's term. */
const NOW = new Date('2026-10-20T12:00:00.000Z')

/**
 * The platform: an administrator, an active teacher, an inactive one, two students, two courses
 * (CSC 101 taught by Dr. Smith, ENG 101 with no teacher), and two programmes: SWE-Y1 (open, both
 * courses, one student) and BMS-Y1 (closed, no courses).
 */
function platform(): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'a1', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 't1', role: 'teacher', fullName: 'Dr. Smith' }),
      userRecord({ id: 't2', role: 'teacher', fullName: 'Mr. Away', status: 'inactive' }),
      userRecord({ id: 's1', role: 'student', fullName: 'Student 01' }),
      userRecord({ id: 's2', role: 'student', fullName: 'Student 02' }),
    ],
    courses: [
      courseRecord({ id: 'c1', code: 'CSC 101', title: 'Intro to Programming', teacherId: 't1' }),
      courseRecord({ id: 'c2', code: 'ENG 101', title: 'English', teacherId: null }),
    ],
    programmes: [
      programmeRecord({ id: 'p1', code: 'SWE-Y1', name: 'Software Engineering · Year 1' }),
      programmeRecord({
        id: 'p2',
        code: 'BMS-Y1',
        name: 'Business Management · Year 1',
        openEnrolment: false,
      }),
    ],
    programmeCourses: [
      { programmeId: 'p1', courseId: 'c1' },
      { programmeId: 'p1', courseId: 'c2' },
    ],
    programmeMembers: [{ programmeId: 'p1', studentId: 's1' }],
    // Student 1 is in c1 (by their programme), and student 2 is waiting to join SWE-Y1.
    enrollments: [{ courseId: 'c1', studentId: 's1' }],
    programmeRequests: [
      {
        id: 'r1',
        programmeId: 'p1',
        studentId: 's2',
        status: 'pending',
        createdAt: '2026-10-19T08:00:00.000Z',
      },
    ],
  })
}

/** A valid import: a new course (CYB 101, two classes), an existing one (CSC 101) and a new programme. */
function payload(overrides: Partial<ImportPayload> = {}): ImportPayload {
  return {
    timezone: 'Africa/Douala',
    programmes: [
      { code: 'CSN-Y1', name: 'Cyber Security · Year 1', courseCodes: ['CYB 101', 'CSC 101'] },
    ],
    courses: [
      {
        code: 'CYB 101',
        title: 'Intro to Cybersecurity',
        teacherId: 't1',
        sessions: [
          { start: '2026-10-20T08:00', end: '2026-10-20T12:00', title: 'Week 2' },
          { start: '2026-10-27T08:00', end: '2026-10-27T12:00', title: 'Week 3' },
        ],
      },
      {
        code: 'CSC 101',
        title: 'Not used: the course exists',
        teacherId: null,
        sessions: [{ start: '2026-10-19T13:00', end: '2026-10-19T15:00', title: 'Week 2' }],
      },
    ],
    ...overrides,
  }
}

/** Runs the contract against `create`. */
export function describeProgrammeServiceContract(name: string, create: CreateProgrammeService) {
  /** A service over a fresh platform, acting as Amara. */
  const service = (data = platform()) => create(data, NOW, 'a1')

  describe(`${name} ProgrammeService contract`, () => {
    describe('listProgrammes', () => {
      // Proves every programme is listed A to Z with its counts and whether students may join.
      it('lists programmes with their counts, A to Z by code', async () => {
        const list = await service().listProgrammes()

        expect(list.map((item) => ({ ...item, id: 'id' }))).toEqual([
          {
            id: 'id',
            code: 'BMS-Y1',
            name: 'Business Management · Year 1',
            openEnrolment: false,
            courseCount: 0,
            studentCount: 0,
            pendingRequestCount: 0,
          },
          {
            id: 'id',
            code: 'SWE-Y1',
            name: 'Software Engineering · Year 1',
            openEnrolment: true,
            courseCount: 2,
            studentCount: 1,
            pendingRequestCount: 1,
          },
        ])
      })

      // Proves a platform with no programmes gives an empty list.
      it('lists nothing when there are no programmes', async () => {
        expect(
          await service(emptyPlatformData({ users: platform().users })).listProgrammes(),
        ).toEqual([])
      })
    })

    describe('setEnrolmentOpen', () => {
      // Proves a programme can be closed and opened again, and the answer shows the new state.
      it('closes and reopens a programme', async () => {
        const programmes = service()
        const [, swe] = await programmes.listProgrammes()

        const closed = await programmes.setEnrolmentOpen(swe?.id ?? '', false)
        expect(closed).toMatchObject({ code: 'SWE-Y1', openEnrolment: false })
        expect(
          (await programmes.listProgrammes()).find((p) => p.code === 'SWE-Y1')?.openEnrolment,
        ).toBe(false)

        const opened = await programmes.setEnrolmentOpen(swe?.id ?? '', true)
        expect(opened.openEnrolment).toBe(true)
      })

      // Proves an unknown programme is not found.
      it('rejects an unknown programme', async () => {
        await expect(
          service().setEnrolmentOpen('00000000-0000-0000-0000-000000000099', false),
        ).rejects.toMatchObject({ kind: 'not_found' })
      })
    })

    describe('programme requests', () => {
      // Proves the waiting requests are listed with who asked and for what.
      it('lists the waiting requests', async () => {
        const requests = await service().listProgrammeRequests()

        expect(
          requests.map((request) => ({ ...request, id: 'id', programmeId: 'p', studentId: 's' })),
        ).toEqual([
          {
            id: 'id',
            programmeId: 'p',
            programmeCode: 'SWE-Y1',
            programmeName: 'Software Engineering · Year 1',
            studentId: 's',
            studentName: 'Student 02',
            studentEmail: expect.stringContaining('@') as string,
            createdAt: expect.any(String) as string,
          },
        ])
      })

      // Proves approving enrols the student in the programme's courses and makes it theirs.
      it('approves a request: the student joins the programme and its courses', async () => {
        const data = platform()
        const programmes = service(data)
        const [request] = await programmes.listProgrammeRequests()

        await programmes.decideProgrammeRequest(request?.id ?? '', 'approved')

        expect(await programmes.listProgrammeRequests()).toEqual([])
        const members = await programmes.listProgrammeMembers(request?.programmeId ?? '')
        expect(members.map((member) => member.studentName)).toEqual(['Student 01', 'Student 02'])
        expect((await programmes.listProgrammes()).find((p) => p.code === 'SWE-Y1')).toMatchObject({
          studentCount: 2,
          pendingRequestCount: 0,
        })
      })

      // Proves declining enrols nobody and the request leaves the waiting list.
      it('declines a request without enrolling anyone', async () => {
        const programmes = service()
        const [request] = await programmes.listProgrammeRequests()

        await programmes.decideProgrammeRequest(request?.id ?? '', 'declined')

        expect(await programmes.listProgrammeRequests()).toEqual([])
        expect(
          (await programmes.listProgrammes()).find((p) => p.code === 'SWE-Y1')?.studentCount,
        ).toBe(1)
      })

      // Proves a request is decided once.
      it('refuses to decide a request twice', async () => {
        const programmes = service()
        const [request] = await programmes.listProgrammeRequests()
        await programmes.decideProgrammeRequest(request?.id ?? '', 'declined')

        await expect(
          programmes.decideProgrammeRequest(request?.id ?? '', 'approved'),
        ).rejects.toMatchObject({ kind: 'conflict' })
      })

      // Proves an unknown request is not found.
      it('rejects an unknown request', async () => {
        await expect(
          service().decideProgrammeRequest('00000000-0000-0000-0000-000000000099', 'approved'),
        ).rejects.toMatchObject({ kind: 'not_found' })
      })
    })

    describe('programme members', () => {
      // Proves the members are listed with their names, and a programme with none lists none.
      it('lists the students in a programme', async () => {
        const programmes = service()
        const swe = (await programmes.listProgrammes()).find((p) => p.code === 'SWE-Y1')
        const bms = (await programmes.listProgrammes()).find((p) => p.code === 'BMS-Y1')

        const members = await programmes.listProgrammeMembers(swe?.id ?? '')

        expect(members.map((member) => member.studentName)).toEqual(['Student 01'])
        expect(await programmes.listProgrammeMembers(bms?.id ?? '')).toEqual([])
      })

      // Proves removing takes the student out of the programme, and the programme's courses, and
      // the list and counts follow.
      it('removes a student from their programme and its courses', async () => {
        const data = platform()
        const programmes = service(data)

        const left = await programmes.removeFromProgramme('s1')

        expect(left).toBe(1)
        expect(
          (await programmes.listProgrammes()).find((p) => p.code === 'SWE-Y1')?.studentCount,
        ).toBe(0)
        const swe = (await programmes.listProgrammes()).find((p) => p.code === 'SWE-Y1')
        expect(await programmes.listProgrammeMembers(swe?.id ?? '')).toEqual([])
      })

      // Proves a student who is not in a programme is not found.
      it('rejects a student who is not in a programme', async () => {
        await expect(service().removeFromProgramme('s2')).rejects.toMatchObject({
          kind: 'not_found',
        })
      })
    })

    describe('importTimetable', () => {
      // Proves a dry run says what would happen and saves nothing.
      it('previews an import without saving it', async () => {
        const programmes = service()

        const outcome = await programmes.importTimetable(payload(), { dryRun: true })

        expect(outcome).toEqual({
          programmesCreated: 1,
          programmesExisting: 0,
          coursesCreated: 1,
          coursesExisting: 1,
          classesCreated: 3,
          classesSkipped: 0,
          teachersAssigned: 1,
        })
        expect((await programmes.listProgrammes()).map((p) => p.code)).toEqual(['BMS-Y1', 'SWE-Y1'])
      })

      // Proves a real import creates the programme with its courses and gives the same counts.
      it('creates the programmes, courses and classes', async () => {
        const programmes = service()

        const outcome = await programmes.importTimetable(payload(), { dryRun: false })

        expect(outcome).toMatchObject({ coursesCreated: 1, classesCreated: 3 })
        const csn = (await programmes.listProgrammes()).find((p) => p.code === 'CSN-Y1')
        expect(csn).toMatchObject({
          name: 'Cyber Security · Year 1',
          courseCount: 2,
          openEnrolment: true,
        })
      })

      // Proves running the same import twice adds nothing the second time.
      it('is safe to run again', async () => {
        const programmes = service()
        await programmes.importTimetable(payload(), { dryRun: false })

        const again = await programmes.importTimetable(payload(), { dryRun: false })

        expect(again).toEqual({
          programmesCreated: 0,
          programmesExisting: 1,
          coursesCreated: 0,
          coursesExisting: 2,
          classesCreated: 0,
          classesSkipped: 3,
          teachersAssigned: 0,
        })
      })

      // Proves course codes match in any letter case and spacing, so "csc101" is CSC 101.
      it('matches courses by code in any letter case', async () => {
        const outcome = await service().importTimetable(
          payload({
            programmes: [],
            courses: [{ code: 'csc  101', title: 'x', teacherId: null, sessions: [] }],
          }),
          { dryRun: true },
        )

        expect(outcome).toMatchObject({ coursesCreated: 0, coursesExisting: 1 })
      })

      // Proves an existing course with no teacher gets the given one, and one with a teacher keeps theirs.
      it('fills in a missing teacher but never replaces one', async () => {
        const programmes = service()

        const outcome = await programmes.importTimetable(
          payload({
            programmes: [],
            courses: [
              { code: 'ENG 101', title: 'x', teacherId: 't1', sessions: [] },
              { code: 'CSC 101', title: 'x', teacherId: 't1', sessions: [] },
            ],
          }),
          { dryRun: false },
        )

        expect(outcome.teachersAssigned).toBe(1)
      })

      // Proves a teacher who is not active is refused, and nothing is kept.
      it('refuses an inactive teacher and keeps nothing', async () => {
        const programmes = service()

        await expect(
          programmes.importTimetable(
            payload({
              courses: [{ code: 'NEW 101', title: 'New', teacherId: 't2', sessions: [] }],
              programmes: [],
            }),
            { dryRun: false },
          ),
        ).rejects.toMatchObject({ kind: 'validation' })
        const again = await programmes.importTimetable(
          payload({
            courses: [{ code: 'NEW 101', title: 'New', teacherId: null, sessions: [] }],
            programmes: [],
          }),
          { dryRun: true },
        )
        expect(again.coursesCreated).toBe(1)
      })

      // Proves a payload that breaks the rules is refused whole.
      it.each([
        ['an unknown time zone', { timezone: 'Mars/Base' }],
        [
          'a course code in the wrong form',
          { courses: [{ code: 'BAD', title: 'x', teacherId: null, sessions: [] }] },
        ],
        [
          'a course without a title',
          { courses: [{ code: 'NEW 101', title: ' ', teacherId: null, sessions: [] }] },
        ],
        [
          'a class that ends before it starts',
          {
            courses: [
              {
                code: 'NEW 101',
                title: 'x',
                teacherId: null,
                sessions: [{ start: '2026-10-20T12:00', end: '2026-10-20T08:00', title: 'Bad' }],
              },
            ],
          },
        ],
        [
          'a programme that names a course that does not exist',
          { programmes: [{ code: 'X-Y1', name: 'X', courseCodes: ['NOPE 999'] }] },
        ],
      ] as [string, Partial<ImportPayload>][])('refuses %s', async (_name, overrides) => {
        await expect(
          service().importTimetable(payload(overrides), { dryRun: false }),
        ).rejects.toMatchObject({ kind: 'validation' })
      })

      // Proves a class whose start already exists for the course is skipped, not doubled.
      it('skips a class that already starts at the same moment', async () => {
        const programmes = service()
        await programmes.importTimetable(payload(), { dryRun: false })

        const outcome = await programmes.importTimetable(
          payload({
            programmes: [],
            courses: [
              {
                code: 'CYB 101',
                title: 'x',
                teacherId: null,
                sessions: [
                  { start: '2026-10-20T08:00', end: '2026-10-20T12:00', title: 'Again' },
                  { start: '2026-11-03T08:00', end: '2026-11-03T12:00', title: 'New one' },
                ],
              },
            ],
          }),
          { dryRun: false },
        )

        expect(outcome).toMatchObject({ classesCreated: 1, classesSkipped: 1 })
      })
    })
  })
}
