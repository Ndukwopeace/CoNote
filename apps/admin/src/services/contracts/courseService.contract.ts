/**
 * The rules every CourseService must follow (ENGINEERING_STANDARDS.md 2.5), run against each
 * implementation. Each run starts from the same small platform built here.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The data the services read, and the record builders.
import {
  courseRecord,
  emptyPlatformData,
  enrollmentRequestRecord,
  userRecord,
  type PlatformData,
  classRecord,
} from '../platformData'
// The interface under test.
import type { CourseService } from '../types'
// Course shapes.
import type { CourseInput } from '@/types/courses'

/** Builds a service over `data`, with the clock at `now`, acting as administrator `actorId`. */
export type CreateCourseService = (data: PlatformData, now: Date, actorId: string) => CourseService

/** The contract's clock. */
const NOW = new Date('2026-10-08T12:00:00.000Z')

/** The message an archived course gives to every change. */
const ARCHIVED_MESSAGE = 'This course is archived. Restore it to make changes.'

/** The message for a teacher who can't be assigned. */
const TEACHER_MESSAGE = 'Choose an active teacher.'

/**
 * The platform: an administrator (Amara acts), three teachers (one inactive), five students (one
 * suspended), and 23 courses in use plus one archived. CSC 101
 * is taught by Dr. Smith, ENG 101 by Mrs. Okoro, SWE 311 has no teacher, and ZZZ 101 to ZZZ 120
 * fill a second page. CSC 101 has classes, summaries and resources.
 */
function platform(): PlatformData {
  // Twenty courses that only exist to fill a second page.
  const fillers = Array.from({ length: 20 }, (_, index) =>
    courseRecord({
      id: `z${String(index + 1)}`,
      code: `ZZZ ${String(101 + index)}`,
      title: `Filler ${String(index + 1)}`,
    }),
  )
  return emptyPlatformData({
    users: [
      userRecord({ id: 'a1', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({
        id: 't1',
        role: 'teacher',
        fullName: 'Dr. Smith',
        email: 'smith@conote.example',
        department: 'Computer Science',
      }),
      userRecord({ id: 't2', role: 'teacher', fullName: 'Mrs. Okoro', department: 'English' }),
      userRecord({ id: 't3', role: 'teacher', fullName: 'Mr. Away', status: 'inactive' }),
      userRecord({
        id: 's01',
        role: 'student',
        fullName: 'Student 01',
        email: 'student01@conote.example',
        studentNumber: 'U2023/5001',
      }),
      userRecord({
        id: 's02',
        role: 'student',
        fullName: 'Student 02',
        email: 'student02@conote.example',
        studentNumber: 'U2023/5002',
      }),
      userRecord({
        id: 's03',
        role: 'student',
        fullName: 'Student 03',
        email: 'student03@conote.example',
        studentNumber: 'U2023/5003',
        status: 'suspended',
      }),
      userRecord({
        id: 's04',
        role: 'student',
        fullName: 'Student 04',
        email: 'student04@conote.example',
        studentNumber: 'U2023/5004',
      }),
      userRecord({
        id: 's05',
        role: 'student',
        fullName: 'Student 05',
        email: 'student05@conote.example',
        studentNumber: 'U2023/5005',
      }),
    ],
    courses: [
      courseRecord({
        id: 'c1',
        code: 'CSC 101',
        title: 'Programming',
        description: 'Learn to program.',
        department: 'Computer Science',
        teacherId: 't1',
      }),
      courseRecord({
        id: 'c2',
        code: 'ENG 101',
        title: 'Writing',
        department: 'English',
        teacherId: 't2',
        status: 'completed',
      }),
      courseRecord({
        id: 'c3',
        code: 'OLD 100',
        title: 'Old course',
        teacherId: 't1',
        archivedAt: '2026-09-01T09:00:00.000Z',
      }),
      courseRecord({
        id: 'c4',
        code: 'SWE 311',
        title: 'Software Engineering',
        department: 'Computer Science',
        status: 'upcoming',
      }),
      ...fillers,
    ],
    enrollments: [
      { courseId: 'c1', studentId: 's01' },
      { courseId: 'c2', studentId: 's01' },
      { courseId: 'c2', studentId: 's02' },
      { courseId: 'c3', studentId: 's01' },
    ],
    // Requests to join: three waiting on SWE 311 (one from a suspended student), two on CSC 101
    // (one from a student who is already in it), one declined, and one on the archived course.
    enrollmentRequests: [
      enrollmentRequestRecord({
        id: 'q1',
        courseId: 'c4',
        studentId: 's04',
        createdAt: '2026-10-02T09:00:00.000Z',
      }),
      enrollmentRequestRecord({
        id: 'q2',
        courseId: 'c4',
        studentId: 's05',
        createdAt: '2026-10-01T09:00:00.000Z',
      }),
      enrollmentRequestRecord({
        id: 'q3',
        courseId: 'c1',
        studentId: 's02',
        createdAt: '2026-10-03T09:00:00.000Z',
      }),
      enrollmentRequestRecord({
        id: 'q4',
        courseId: 'c4',
        studentId: 's03',
        createdAt: '2026-10-04T09:00:00.000Z',
      }),
      enrollmentRequestRecord({
        id: 'q5',
        courseId: 'c4',
        studentId: 's01',
        status: 'declined',
        createdAt: '2026-09-25T09:00:00.000Z',
        decidedAt: '2026-09-26T09:00:00.000Z',
        decidedBy: 'a1',
      }),
      enrollmentRequestRecord({
        id: 'q6',
        courseId: 'c3',
        studentId: 's02',
        createdAt: '2026-10-05T09:00:00.000Z',
      }),
      enrollmentRequestRecord({
        id: 'q7',
        courseId: 'c1',
        studentId: 's01',
        createdAt: '2026-10-06T09:00:00.000Z',
      }),
    ],
    classes: [
      classRecord({
        id: 'cl2',
        courseId: 'c1',
        title: 'Loops',
        startsAt: '2026-09-17T09:00:00.000Z',
        archivedAt: null,
      }),
      classRecord({
        id: 'cl1',
        courseId: 'c1',
        title: 'Variables',
        startsAt: '2026-09-10T09:00:00.000Z',
        archivedAt: null,
      }),
      classRecord({
        id: 'cl3',
        courseId: 'c1',
        title: 'Cancelled',
        startsAt: '2026-09-24T09:00:00.000Z',
        archivedAt: '2026-09-20T09:00:00.000Z',
      }),
      classRecord({
        id: 'cl4',
        courseId: 'c2',
        title: 'Essays',
        startsAt: '2026-09-11T09:00:00.000Z',
        archivedAt: null,
      }),
    ],
    summaries: [
      {
        id: 'sm1',
        classId: 'cl1',
        status: 'published',
        inReviewSince: null,
        publishedAt: '2026-09-12T09:00:00.000Z',
      },
      {
        id: 'sm2',
        classId: 'cl2',
        status: 'in_review',
        inReviewSince: '2026-09-18T09:00:00.000Z',
        publishedAt: null,
      },
    ],
    resources: [
      {
        id: 'r1',
        title: 'Outline',
        type: 'pdf',
        courseId: 'c1',
        classId: null,
        status: 'published',
        createdAt: '2026-09-01T09:00:00.000Z',
      },
      {
        id: 'r2',
        title: 'Week 1 slides',
        type: 'slides',
        courseId: 'c1',
        classId: 'cl1',
        status: 'draft',
        createdAt: '2026-09-02T09:00:00.000Z',
      },
      {
        id: 'r3',
        title: 'Elsewhere',
        type: 'link',
        courseId: 'c2',
        classId: null,
        status: 'published',
        createdAt: '2026-09-02T09:00:00.000Z',
      },
    ],
  })
}

/** A valid course form, for tests to override only what they check. */
function input(overrides: Partial<CourseInput> = {}): CourseInput {
  return {
    code: 'MTH 201',
    title: 'Calculus',
    description: 'Limits and derivatives.',
    department: 'Mathematics',
    status: 'upcoming',
    teacherId: null,
    ...overrides,
  }
}

/** Registers the CourseService contract suite under `name`. */
export function describeCourseServiceContract(name: string, create: CreateCourseService) {
  /** A fresh service over the platform, acting as Amara. */
  const service = () => create(platform(), NOW, 'a1')
  /** The codes on one page. */
  const codes = async (svc: CourseService, filter = {}) =>
    (await svc.listCourses(filter)).items.map((course) => course.code)

  describe(`CourseService contract: ${name}`, () => {
    // Proves the list shows courses in use by code, 20 to a page, with the full count.
    it('lists courses in use by code, 20 to a page', async () => {
      const page = await service().listCourses({})
      expect(page).toMatchObject({ total: 23, page: 1, pageSize: 20 })
      expect(page.items).toHaveLength(20)
      expect(page.items.slice(0, 3).map((course) => course.code)).toEqual([
        'CSC 101',
        'ENG 101',
        'SWE 311',
      ])
    })

    // Proves the second page holds the rest, and a page past the end shows the last one.
    it('returns later pages', async () => {
      const svc = service()
      expect(await codes(svc, { page: 2 })).toEqual(['ZZZ 118', 'ZZZ 119', 'ZZZ 120'])
      expect((await svc.listCourses({ page: 9 })).page).toBe(2)
    })

    // Proves each row carries the figures the list shows.
    it('describes each row', async () => {
      const [csc] = (await service().listCourses({ q: 'CSC' })).items
      expect(csc).toMatchObject({
        id: 'c1',
        code: 'CSC 101',
        title: 'Programming',
        department: 'Computer Science',
        status: 'ongoing',
        teacher: { id: 't1', fullName: 'Dr. Smith' },
        studentCount: 1,
        // Two classes in use; the archived one doesn't count.
        classCount: 2,
        archivedAt: null,
      })
    })

    // Proves archived courses appear only when asked for.
    it('shows archived courses only when asked', async () => {
      const svc = service()
      expect(await codes(svc)).not.toContain('OLD 100')
      expect(await codes(svc, { archived: true })).toEqual(['OLD 100'])
    })

    // Proves the search matches code and title, ignoring case.
    it('searches codes and titles', async () => {
      const svc = service()
      expect(await codes(svc, { q: 'csc' })).toEqual(['CSC 101'])
      expect(await codes(svc, { q: 'WRITING' })).toEqual(['ENG 101'])
    })

    // Proves the status, department and teacher filters, including "no teacher".
    it('filters by status, department and teacher', async () => {
      const svc = service()
      expect(await codes(svc, { status: 'completed' })).toEqual(['ENG 101'])
      expect(await codes(svc, { department: 'Computer Science' })).toEqual(['CSC 101', 'SWE 311'])
      expect(await codes(svc, { teacher: 't2' })).toEqual(['ENG 101'])
      // "none" means no teacher: SWE 311 and the 20 fillers, 21 in all.
      const unassigned = await svc.listCourses({ teacher: 'none' })
      expect(unassigned.total).toBe(21)
      expect(unassigned.items[0]?.code).toBe('SWE 311')
    })

    // Proves the sorts.
    it('sorts by code, title and students', async () => {
      const svc = service()
      expect((await codes(svc, { sort: '-code' }))[0]).toBe('ZZZ 120')
      expect((await codes(svc, { sort: 'title' }))[0]).toBe('ZZZ 101')
      // "Filler 1" is first A to Z; students sort by count, then code.
      expect((await codes(svc, { sort: '-students' }))[0]).toBe('ENG 101')
      expect((await codes(svc, { sort: 'students', q: '1' }))[0]).toBe('SWE 311')
    })

    // Proves the filter options are the departments in use and the active teachers, A to Z.
    it('offers departments and active teachers', async () => {
      const options = await service().listCourseFilterOptions()
      expect(options.departments).toEqual(['Computer Science', 'English'])
      expect(options.teachers).toEqual([
        { id: 't1', fullName: 'Dr. Smith', department: 'Computer Science' },
        { id: 't2', fullName: 'Mrs. Okoro', department: 'English' },
      ])
      expect(options.teachers.some((teacher) => teacher.id === 't3')).toBe(false)
    })

    // Proves the details: classes oldest first with summary stages, resources, and counts.
    it('returns a course with its classes and resources', async () => {
      const course = await service().getCourse('c1')
      expect(course).toMatchObject({
        code: 'CSC 101',
        description: 'Learn to program.',
        studentCount: 1,
        publishedSummaryCount: 1,
      })
      expect(course.classes.map((item) => [item.title, item.summaryStatus, item.archived])).toEqual(
        [
          ['Variables', 'published', false],
          ['Loops', 'in_review', false],
          ['Cancelled', null, true],
        ],
      )
      expect(course.resources.map((item) => [item.title, item.classTitle])).toEqual([
        ['Outline', null],
        ['Week 1 slides', 'Variables'],
      ])
    })

    // Proves an unknown course is not found.
    it('rejects an unknown course', async () => {
      await expect(service().getCourse('nope')).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves creating stores the course tidily and returns it.
    it('creates a course', async () => {
      const course = await service().createCourse(
        input({ code: 'mth201', teacherId: 't2', description: '  Limits.  ' }),
      )
      expect(course).toMatchObject({
        code: 'MTH 201',
        title: 'Calculus',
        description: 'Limits.',
        status: 'upcoming',
        teacher: { id: 't2', fullName: 'Mrs. Okoro' },
        studentCount: 0,
        archivedAt: null,
      })
      expect(course.id).not.toBe('')
    })

    // Proves a created course shows up in the list.
    it('lists a new course', async () => {
      const svc = service()
      await svc.createCourse(input())
      expect(await codes(svc, { q: 'MTH' })).toEqual(['MTH 201'])
    })

    // Proves codes are unique whatever the letter case or spacing.
    it('rejects a code that is already taken', async () => {
      const svc = service()
      await expect(svc.createCourse(input({ code: 'csc101' }))).rejects.toMatchObject({
        kind: 'conflict',
        message: 'A course with this code already exists.',
      })
      // Archived courses keep their codes.
      await expect(svc.createCourse(input({ code: 'OLD 100' }))).rejects.toMatchObject({
        kind: 'conflict',
      })
    })

    // Proves the form rules are enforced here too.
    it('rejects an invalid course', async () => {
      const svc = service()
      await expect(svc.createCourse(input({ code: 'nonsense' }))).rejects.toMatchObject({
        kind: 'validation',
        message: 'Enter a code like SWE 311.',
      })
      await expect(svc.createCourse(input({ title: '  ' }))).rejects.toMatchObject({
        kind: 'validation',
        message: 'Enter a title.',
      })
    })

    // Proves only an active teacher can be chosen when creating.
    it('rejects a teacher who is not active, or not a teacher', async () => {
      const svc = service()
      for (const teacherId of ['t3', 's01', 'a1', 'ghost']) {
        await expect(svc.createCourse(input({ teacherId }))).rejects.toMatchObject({
          kind: 'validation',
          message: TEACHER_MESSAGE,
        })
      }
    })

    // Proves editing changes the fields, and a course may keep its own code.
    it('updates a course', async () => {
      const course = await service().updateCourse(
        'c1',
        input({ code: 'csc 101', title: 'Programming II', status: 'completed', teacherId: 't2' }),
      )
      expect(course).toMatchObject({
        code: 'CSC 101',
        title: 'Programming II',
        status: 'completed',
        teacher: { id: 't2', fullName: 'Mrs. Okoro' },
      })
    })

    // Proves a deactivated teacher can stay on a course while other details are edited.
    it('lets an edit keep a teacher who is no longer active', async () => {
      const data = platform()
      const svc = create(data, NOW, 'a1')
      const teacher = data.users.find((user) => user.id === 't1')
      if (teacher) teacher.status = 'inactive'
      const course = await svc.updateCourse(
        'c1',
        input({ code: 'CSC 101', title: 'Renamed', teacherId: 't1' }),
      )
      expect(course).toMatchObject({ title: 'Renamed', teacher: { id: 't1' } })
    })

    // Proves another course's code can't be taken by an edit.
    it('rejects an edit that takes another course’s code', async () => {
      await expect(service().updateCourse('c1', input({ code: 'ENG 101' }))).rejects.toMatchObject({
        kind: 'conflict',
      })
    })

    // Proves editing an unknown course is not found.
    it('rejects editing an unknown course', async () => {
      await expect(service().updateCourse('nope', input())).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // Proves archive hides the course and keeps its students and classes.
    it('archives and restores a course', async () => {
      const svc = service()
      const archived = await svc.archiveCourse('c1')
      expect(archived.archivedAt).toBe(NOW.toISOString())
      expect(await codes(svc, { q: 'CSC' })).toEqual([])
      expect(await codes(svc, { archived: true })).toEqual(['CSC 101', 'OLD 100'])
      // Its students are kept.
      expect(await svc.listEnrollments('c1')).toHaveLength(1)
      // Restoring puts it back.
      const restored = await svc.restoreCourse('c1')
      expect(restored.archivedAt).toBeNull()
      expect(await codes(svc, { q: 'CSC' })).toEqual(['CSC 101'])
    })

    // Proves archive and restore only apply in the right state.
    it('rejects archiving an archived course and restoring one in use', async () => {
      const svc = service()
      await expect(svc.archiveCourse('c3')).rejects.toMatchObject({ kind: 'validation' })
      await expect(svc.restoreCourse('c1')).rejects.toMatchObject({ kind: 'validation' })
    })

    // Proves an archived course refuses every change.
    it('refuses changes to an archived course', async () => {
      const svc = service()
      const refused = { kind: 'validation', message: ARCHIVED_MESSAGE }
      await expect(svc.updateCourse('c3', input())).rejects.toMatchObject(refused)
      await expect(svc.assignTeacher('c3', 't2')).rejects.toMatchObject(refused)
      await expect(svc.removeTeacher('c3')).rejects.toMatchObject(refused)
      await expect(svc.enrollStudents('c3', ['s02'])).rejects.toMatchObject(refused)
      await expect(svc.removeStudent('c3', 's01')).rejects.toMatchObject(refused)
    })

    // Proves assigning, changing and removing the teacher.
    it('assigns, changes and removes the teacher', async () => {
      const svc = service()
      expect((await svc.assignTeacher('c4', 't1')).teacher).toMatchObject({ id: 't1' })
      expect((await svc.assignTeacher('c4', 't2')).teacher).toMatchObject({ id: 't2' })
      expect((await svc.removeTeacher('c4')).teacher).toBeNull()
      // The unassigned course now shows under "no teacher".
      expect(await codes(svc, { teacher: 'none', q: 'SWE' })).toEqual(['SWE 311'])
    })

    // Proves only active teachers can be assigned.
    it('refuses a teacher who is not active', async () => {
      const svc = service()
      for (const teacherId of ['t3', 's01', 'ghost']) {
        await expect(svc.assignTeacher('c4', teacherId)).rejects.toMatchObject({
          kind: 'validation',
          message: TEACHER_MESSAGE,
        })
      }
    })

    // Proves the student list is A to Z and searchable.
    it('lists and searches a course’s students', async () => {
      const svc = service()
      const all = await svc.listEnrollments('c2')
      expect(all.map((student) => student.fullName)).toEqual(['Student 01', 'Student 02'])
      expect(all[0]).toMatchObject({
        id: 's01',
        email: 'student01@conote.example',
        studentNumber: 'U2023/5001',
        status: 'active',
      })
      expect((await svc.listEnrollments('c2', 'U2023/5002')).map((s) => s.id)).toEqual(['s02'])
      expect((await svc.listEnrollments('c2', 'STUDENT01@')).map((s) => s.id)).toEqual(['s01'])
      expect(await svc.listEnrollments('c2', 'nobody')).toEqual([])
    })

    // Proves an unknown course has no student list.
    it('rejects listing the students of an unknown course', async () => {
      await expect(service().listEnrollments('nope')).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves the preview sorts every value into matched, enrolled or unmatched, with a reason.
    it('previews a bulk enrolment', async () => {
      const match = await service().matchStudents('c1', [
        // Email, in another case.
        'Student02@conote.example',
        // Student number.
        'u2023/5004',
        // Already in the course.
        'student01@conote.example',
        // Suspended.
        'student03@conote.example',
        // A teacher.
        'smith@conote.example',
        // Nobody.
        'ghost@conote.example',
        // The same person again, by number.
        'U2023/5002',
      ])
      expect(match.matched.map((student) => student.id)).toEqual(['s02', 's04'])
      expect(match.alreadyEnrolled.map((student) => student.id)).toEqual(['s01'])
      expect(match.unmatched).toEqual([
        { value: 'student03@conote.example', reason: 'not_active' },
        { value: 'smith@conote.example', reason: 'not_a_student' },
        { value: 'ghost@conote.example', reason: 'not_found' },
      ])
    })

    // Proves previewing changes nothing.
    it('changes nothing when previewing', async () => {
      const svc = service()
      await svc.matchStudents('c1', ['student02@conote.example'])
      expect(await svc.listEnrollments('c1')).toHaveLength(1)
    })

    // Proves enrolling adds only the students who can be added.
    it('enrols the valid students and skips the rest', async () => {
      const svc = service()
      // s02 and s04 are new; s01 is already in; s03 is suspended; a1 is not a student; one is unknown.
      const result = await svc.enrollStudents('c1', [
        's02',
        's04',
        's01',
        's03',
        'a1',
        'ghost',
        's02',
      ])
      expect(result).toEqual({ added: 2 })
      expect((await svc.listEnrollments('c1')).map((student) => student.id)).toEqual([
        's01',
        's02',
        's04',
      ])
      // The count on the list follows.
      expect((await svc.getCourse('c1')).studentCount).toBe(3)
    })

    // Proves removing a student takes them out of that course only.
    it('removes a student from the course', async () => {
      const svc = service()
      await svc.removeStudent('c2', 's01')
      expect((await svc.listEnrollments('c2')).map((student) => student.id)).toEqual(['s02'])
      expect(await svc.listEnrollments('c1')).toHaveLength(1)
    })

    // Proves removing someone who isn't in the course is reported.
    it('rejects removing a student who is not in the course', async () => {
      await expect(service().removeStudent('c1', 's05')).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // Proves the enrolment routes reject unknown courses.
    it('rejects enrolment work on an unknown course', async () => {
      const svc = service()
      await expect(svc.matchStudents('nope', [])).rejects.toMatchObject({ kind: 'not_found' })
      await expect(svc.enrollStudents('nope', ['s02'])).rejects.toMatchObject({
        kind: 'not_found',
      })
      await expect(svc.removeStudent('nope', 's01')).rejects.toMatchObject({ kind: 'not_found' })
      await expect(svc.archiveCourse('nope')).rejects.toMatchObject({ kind: 'not_found' })
    })

    describe('requests to join (D76)', () => {
      // Proves the waiting requests come oldest first, each with who asked, and the declined
      // one is left out.
      it('lists the waiting requests, oldest first', async () => {
        const requests = await service().listEnrollmentRequests('c4')

        expect(requests.map((request) => request.id)).toEqual(['q2', 'q1', 'q4'])
        expect(requests[0]).toEqual({
          id: 'q2',
          requestedAt: '2026-10-01T09:00:00.000Z',
          student: {
            id: 's05',
            fullName: 'Student 05',
            email: 'student05@conote.example',
            studentNumber: 'U2023/5005',
            status: 'active',
          },
        })
      })

      // Proves a course with no requests gives an empty list, an archived course can still be read,
      // and an unknown course is not found.
      it('lists nothing for a course without requests, and rejects an unknown course', async () => {
        const svc = service()

        await expect(svc.listEnrollmentRequests('c2')).resolves.toEqual([])
        await expect(svc.listEnrollmentRequests('c3')).resolves.toHaveLength(1)
        await expect(svc.listEnrollmentRequests('nope')).rejects.toMatchObject({
          kind: 'not_found',
        })
      })

      // Proves approving enrols the student and takes the request off the list.
      it('enrols the student on approval', async () => {
        const svc = service()

        await svc.decideEnrollmentRequest('q1', 'approved')

        expect((await svc.listEnrollmentRequests('c4')).map((r) => r.id)).toEqual(['q2', 'q4'])
        expect((await svc.listEnrollments('c4')).map((student) => student.id)).toContain('s04')
      })

      // Proves declining enrols nobody and takes the request off the list.
      it('enrols nobody on a decline', async () => {
        const svc = service()

        await svc.decideEnrollmentRequest('q2', 'declined')

        expect((await svc.listEnrollmentRequests('c4')).map((r) => r.id)).toEqual(['q1', 'q4'])
        expect((await svc.listEnrollments('c4')).map((student) => student.id)).not.toContain('s05')
      })

      // Proves a request from someone already in the course is closed without enrolling twice.
      it('closes a request from a student who is already in the course', async () => {
        const svc = service()
        const before = (await svc.listEnrollments('c1')).length

        await svc.decideEnrollmentRequest('q7', 'approved')

        expect(await svc.listEnrollments('c1')).toHaveLength(before)
        expect((await svc.listEnrollmentRequests('c1')).map((r) => r.id)).toEqual(['q3'])
      })

      // SECURITY: proves an account that can't be enrolled (suspended) can't be approved, and the
      // request stays waiting so the administrator can decline it.
      it('refuses to approve a student who can not be enrolled', async () => {
        const svc = service()

        await expect(svc.decideEnrollmentRequest('q4', 'approved')).rejects.toMatchObject({
          kind: 'validation',
          message: "This account can't be enrolled.",
        })

        expect((await svc.listEnrollmentRequests('c4')).map((r) => r.id)).toContain('q4')
        await expect(svc.decideEnrollmentRequest('q4', 'declined')).resolves.toBeUndefined()
      })

      // Proves an archived course refuses both decisions, and the request stays waiting.
      it.each(['approved', 'declined'] as const)(
        'refuses to decide a request on an archived course (%s)',
        async (decision) => {
          const svc = service()

          await expect(svc.decideEnrollmentRequest('q6', decision)).rejects.toMatchObject({
            kind: 'validation',
            message: ARCHIVED_MESSAGE,
          })

          await expect(svc.listEnrollmentRequests('c3')).resolves.toHaveLength(1)
        },
      )

      // Proves a request is decided once, and an unknown or already-closed one is refused.
      it('refuses a second decision and an unknown request', async () => {
        const svc = service()
        await svc.decideEnrollmentRequest('q1', 'approved')

        await expect(svc.decideEnrollmentRequest('q1', 'declined')).rejects.toMatchObject({
          kind: 'conflict',
        })
        await expect(svc.decideEnrollmentRequest('q5', 'approved')).rejects.toMatchObject({
          kind: 'conflict',
        })
        await expect(svc.decideEnrollmentRequest('nope', 'approved')).rejects.toMatchObject({
          kind: 'not_found',
        })
      })

      // SECURITY: proves nobody who isn't signed in as an administrator can decide a request.
      it('refuses a caller who is not signed in', async () => {
        const svc = create(platform(), NOW, '')

        await expect(svc.decideEnrollmentRequest('q1', 'approved')).rejects.toMatchObject({
          kind: 'unauthorized',
        })
      })

      // Proves each row counts its waiting requests, and the filter keeps only courses that have any.
      it('counts waiting requests per course and filters on them', async () => {
        const svc = service()

        const rows = (await svc.listCourses({ requests: 'waiting' })).items

        expect(rows.map((row) => [row.code, row.pendingRequestCount])).toEqual([
          ['CSC 101', 2],
          ['SWE 311', 3],
        ])
        // A course without any shows zero in the unfiltered list.
        const eng = (await svc.listCourses({ q: 'ENG' })).items[0]
        expect(eng?.pendingRequestCount).toBe(0)
      })
    })
  })
}
