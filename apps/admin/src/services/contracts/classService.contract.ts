/**
 * The rules every ClassService must follow (ENGINEERING_STANDARDS.md 2.5), run against each
 * implementation. Each run starts from the same small platform built here.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Local dates and times, as the form gives them.
import { toIso } from '@/lib/classTimes'
// The data the services read, and the record builders.
import {
  aiJobRecord,
  classRecord,
  courseRecord,
  emptyPlatformData,
  userRecord,
  type PlatformData,
} from '../platformData'
// The interface under test.
import type { ClassService } from '../types'
// Class shapes.
import type { ClassInput } from '@/types/classes'

/** Builds a service over `data`, with the clock at `now`, acting as administrator `actorId`. */
export type CreateClassService = (data: PlatformData, now: Date, actorId: string) => ClassService

/** The contract's clock. */
const NOW = new Date('2026-10-08T12:00:00.000Z')

/** The message for a change to an archived course. */
const COURSE_ARCHIVED_MESSAGE = 'This course is archived. Restore it to make changes.'

/** The message for a change to an archived class. */
const CLASS_ARCHIVED_MESSAGE = 'This class is archived. It can’t be changed.'

/** The platform's 22 classes of CSC 101 are numbered 1 to 22; `start` is the nth one's date. */
function day(n: number) {
  return toIso(`2026-09-${String(n).padStart(2, '0')}`, '09:00')
}

/**
 * The platform: an administrator (Amara acts), Dr. Smith, four students (two enrolled in CSC 101),
 * CSC 101 (taught by Dr. Smith, 22 classes), ENG 101 (no teacher, one class), and an archived
 * course OLD 100. CSC 101's first class has a published summary and two AI jobs (a failure, then
 * a success); its second is in review; its third is archived; the rest have no summary.
 */
function platform(): PlatformData {
  // CSC 101's classes: number n on September n.
  const cscClasses = Array.from({ length: 22 }, (_, index) =>
    classRecord({
      id: `k${String(index + 1)}`,
      courseId: 'c1',
      number: index + 1,
      title: `Lesson ${String(index + 1)}`,
      startsAt: day(index + 1),
      endsAt: toIso(`2026-09-${String(index + 1).padStart(2, '0')}`, '10:30'),
      noteCount: index === 0 ? 14 : 0,
      archivedAt: index === 2 ? '2026-09-20T09:00:00.000Z' : null,
    }),
  )
  return emptyPlatformData({
    users: [
      userRecord({ id: 'a1', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 't1', role: 'teacher', fullName: 'Dr. Smith' }),
      userRecord({ id: 's1', role: 'student' }),
      userRecord({ id: 's2', role: 'student' }),
      userRecord({ id: 's3', role: 'student' }),
      userRecord({ id: 's4', role: 'student' }),
    ],
    courses: [
      courseRecord({ id: 'c1', code: 'CSC 101', title: 'Programming', teacherId: 't1' }),
      courseRecord({ id: 'c2', code: 'ENG 101', title: 'Writing' }),
      courseRecord({
        id: 'c3',
        code: 'OLD 100',
        title: 'Old course',
        archivedAt: '2026-09-01T09:00:00.000Z',
      }),
    ],
    enrollments: [
      { courseId: 'c1', studentId: 's1' },
      { courseId: 'c1', studentId: 's2' },
      { courseId: 'c2', studentId: 's1' },
    ],
    classes: [
      ...cscClasses,
      classRecord({
        id: 'k30',
        courseId: 'c2',
        number: 4,
        title: 'Essays',
        startsAt: day(5),
        endsAt: toIso('2026-09-05', '11:00'),
      }),
      classRecord({
        id: 'k40',
        courseId: 'c3',
        number: 1,
        title: 'Final lesson',
        startsAt: day(1),
        endsAt: toIso('2026-09-01', '10:30'),
      }),
    ],
    summaries: [
      {
        id: 'sm1',
        classId: 'k1',
        status: 'published',
        inReviewSince: '2026-09-01T13:00:00.000Z',
        publishedAt: '2026-09-02T09:00:00.000Z',
      },
      {
        id: 'sm2',
        classId: 'k2',
        status: 'in_review',
        inReviewSince: '2026-09-02T13:00:00.000Z',
        publishedAt: null,
      },
    ],
    aiJobs: [
      aiJobRecord({
        id: 'j2',
        classId: 'k1',
        status: 'succeeded',
        attempt: 2,
        createdAt: '2026-09-01T12:30:00.000Z',
        finishedAt: '2026-09-01T13:00:00.000Z',
      }),
      aiJobRecord({
        id: 'j1',
        classId: 'k1',
        status: 'failed',
        attempt: 1,
        createdAt: '2026-09-01T11:30:00.000Z',
        finishedAt: '2026-09-01T11:45:00.000Z',
      }),
    ],
  })
}

/** A valid class form for CSC 101, for tests to override only what they check. */
function input(overrides: Partial<ClassInput> = {}): ClassInput {
  return {
    courseId: 'c1',
    title: 'Recursion',
    date: '2026-10-20',
    startTime: '09:00',
    endTime: '10:30',
    description: 'Functions that call themselves.',
    ...overrides,
  }
}

/** Registers the ClassService contract suite under `name`. */
export function describeClassServiceContract(name: string, create: CreateClassService) {
  /** A fresh service over the platform, acting as Amara. */
  const service = () => create(platform(), NOW, 'a1')
  /** The class IDs on one page, in order. */
  const ids = async (svc: ClassService, filter = {}) =>
    (await svc.listClasses(filter)).items.map((item) => item.id)

  describe(`ClassService contract: ${name}`, () => {
    // Proves the list shows classes in use, newest first, 20 to a page, with the full count.
    it('lists classes in use, newest first, 20 to a page', async () => {
      const page = await service().listClasses({})
      // 22 + 1 + 1 classes, less the archived one.
      expect(page).toMatchObject({ total: 23, page: 1, pageSize: 20 })
      expect(page.items).toHaveLength(20)
      expect(page.items[0]?.id).toBe('k22')
    })

    // Proves later pages, and that a page past the end shows the last.
    it('returns later pages', async () => {
      const svc = service()
      // Ties on the date fall back to course code, then class number.
      expect(await ids(svc, { page: 2 })).toEqual(['k2', 'k1', 'k40'])
      expect((await svc.listClasses({ page: 9 })).page).toBe(2)
    })

    // Proves each row carries what the list shows.
    it('describes each row', async () => {
      const [first] = (await service().listClasses({ courseId: 'c1', sort: 'date' })).items
      expect(first).toMatchObject({
        id: 'k1',
        number: 1,
        courseCode: 'CSC 101',
        courseTitle: 'Programming',
        title: 'Lesson 1',
        startsAt: day(1),
        teacher: { id: 't1', fullName: 'Dr. Smith' },
        summaryStatus: 'published',
        noteCount: 14,
        archivedAt: null,
      })
      // No teacher and no summary read as null.
      const [essays] = (await service().listClasses({ courseId: 'c2' })).items
      expect(essays).toMatchObject({ teacher: null, summaryStatus: null })
    })

    // Proves archived classes appear only when asked for.
    it('shows archived classes only when asked', async () => {
      const svc = service()
      expect(await ids(svc, { courseId: 'c1', q: 'lesson 3' })).toEqual([])
      expect(await ids(svc, { archived: true })).toEqual(['k3'])
    })

    // Proves the search matches title and course code, ignoring case.
    it('searches titles and course codes', async () => {
      const svc = service()
      expect(await ids(svc, { q: 'ESSAYS' })).toEqual(['k30'])
      expect(await ids(svc, { q: 'eng 101' })).toEqual(['k30'])
      expect(await ids(svc, { q: 'final' })).toEqual(['k40'])
    })

    // Proves the course, summary status and date range filters.
    it('filters by course, summary status and dates', async () => {
      const svc = service()
      expect(await ids(svc, { courseId: 'c2' })).toEqual(['k30'])
      expect(await ids(svc, { summaryStatus: 'published' })).toEqual(['k1'])
      expect(await ids(svc, { summaryStatus: 'in_review' })).toEqual(['k2'])
      // "none": classes in use with no summary yet (23 in use, 2 with summaries).
      expect((await svc.listClasses({ summaryStatus: 'none' })).total).toBe(21)
      // Both ends of the range are included.
      expect(await ids(svc, { from: '2026-09-04', to: '2026-09-05', sort: 'date' })).toEqual([
        'k4',
        'k5',
        'k30',
      ])
    })

    // Proves the sorts.
    it('sorts by date, course and title', async () => {
      const svc = service()
      expect((await ids(svc, { sort: 'date' }))[0]).toBe('k1')
      expect((await ids(svc, { sort: 'course' }))[0]).toBe('k1')
      expect((await ids(svc, { sort: '-course' }))[0]).toBe('k40')
      expect((await ids(svc, { sort: 'title' }))[0]).toBe('k30')
      expect((await ids(svc, { sort: '-title' }))[0]).toBe('k9')
    })

    // Proves the filter options list every course by code, saying which are archived.
    it('offers the courses by code', async () => {
      expect((await service().listClassFilterOptions()).courses).toEqual([
        { id: 'c1', code: 'CSC 101', title: 'Programming', archived: false },
        { id: 'c2', code: 'ENG 101', title: 'Writing', archived: false },
        { id: 'c3', code: 'OLD 100', title: 'Old course', archived: true },
      ])
    })

    // Proves the details: counts, the AI job history and the summary timeline.
    it('returns a class with its jobs and timeline', async () => {
      const details = await service().getClass('k1')
      expect(details).toMatchObject({
        title: 'Lesson 1',
        description: '',
        studentCount: 2,
        noteCount: 14,
      })
      // Jobs, oldest first.
      expect(details.aiJobs.map((job) => [job.id, job.status, job.attempt])).toEqual([
        ['j1', 'failed', 1],
        ['j2', 'succeeded', 2],
      ])
      expect(details.aiJobs[1]).toMatchObject({
        createdAt: '2026-09-01T12:30:00.000Z',
        finishedAt: '2026-09-01T13:00:00.000Z',
      })
      // Every stage reached, with the times that are recorded.
      expect(details.timeline).toEqual([
        { stage: 'collecting', at: day(1), reached: true },
        { stage: 'processing', at: '2026-09-01T11:30:00.000Z', reached: true },
        { stage: 'in_review', at: '2026-09-01T13:00:00.000Z', reached: true },
        { stage: 'published', at: '2026-09-02T09:00:00.000Z', reached: true },
      ])
    })

    // Proves a class still in review shows later stages as not reached.
    it('shows the stages a summary has not reached', async () => {
      const { timeline } = await service().getClass('k2')
      expect(timeline.map((step) => [step.stage, step.reached])).toEqual([
        ['collecting', true],
        ['processing', true],
        ['in_review', true],
        ['published', false],
      ])
      expect(timeline[3]?.at).toBeNull()
    })

    // Proves a class with no summary has reached nothing.
    it('shows no stage reached before a summary exists', async () => {
      const { timeline } = await service().getClass('k30')
      expect(timeline.every((step) => !step.reached)).toBe(true)
    })

    // Proves an unknown class is not found.
    it('rejects an unknown class', async () => {
      await expect(service().getClass('nope')).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves creating numbers the class after the course's last one, never reusing a number.
    it('creates a class numbered after the last', async () => {
      const svc = service()
      const created = await svc.createClass(input())
      expect(created).toMatchObject({
        number: 23,
        courseCode: 'CSC 101',
        title: 'Recursion',
        description: 'Functions that call themselves.',
        startsAt: toIso('2026-10-20', '09:00'),
        endsAt: toIso('2026-10-20', '10:30'),
        teacher: { id: 't1' },
        summaryStatus: null,
        noteCount: 0,
        studentCount: 2,
        archivedAt: null,
      })
      // A course with none starts at 1, and the archived class's number isn't reused.
      expect((await svc.createClass(input({ courseId: 'c2' }))).number).toBe(5)
    })

    // Proves a created class is listed.
    it('lists a new class', async () => {
      const svc = service()
      const created = await svc.createClass(input({ title: 'Brand new' }))
      expect(await ids(svc, { q: 'brand new' })).toEqual([created.id])
    })

    // Proves the form rules are enforced here too.
    it('rejects an invalid class', async () => {
      const svc = service()
      await expect(svc.createClass(input({ title: ' ' }))).rejects.toMatchObject({
        kind: 'validation',
        message: 'Enter a title.',
      })
      await expect(svc.createClass(input({ endTime: '09:00' }))).rejects.toMatchObject({
        kind: 'validation',
        message: 'The end time must be after the start time.',
      })
    })

    // Proves classes are added to real courses in use only.
    it('rejects a missing or archived course', async () => {
      const svc = service()
      await expect(svc.createClass(input({ courseId: 'ghost' }))).rejects.toMatchObject({
        kind: 'validation',
        message: 'Choose a course.',
      })
      await expect(svc.createClass(input({ courseId: 'c3' }))).rejects.toMatchObject({
        kind: 'validation',
        message: COURSE_ARCHIVED_MESSAGE,
      })
    })

    // Proves editing changes the fields and keeps the number and course.
    it('updates a class', async () => {
      const updated = await service().updateClass(
        'k30',
        input({
          courseId: 'c2',
          title: 'Essays II',
          date: '2026-09-06',
          startTime: '10:00',
          endTime: '12:00',
        }),
      )
      expect(updated).toMatchObject({
        number: 4,
        title: 'Essays II',
        startsAt: toIso('2026-09-06', '10:00'),
        endsAt: toIso('2026-09-06', '12:00'),
      })
    })

    // Proves a class can't move to another course (it would break the numbering).
    it('rejects moving a class to another course', async () => {
      await expect(service().updateClass('k30', input({ courseId: 'c1' }))).rejects.toMatchObject({
        kind: 'validation',
        message: 'A class can’t move to another course.',
      })
    })

    // Proves editing an unknown class is not found.
    it('rejects editing an unknown class', async () => {
      await expect(service().updateClass('nope', input())).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // Proves archive hides the class and keeps its notes and summary.
    it('archives a class and keeps its notes and summary', async () => {
      const svc = service()
      const archived = await svc.archiveClass('k1')
      expect(archived).toMatchObject({
        archivedAt: NOW.toISOString(),
        noteCount: 14,
        summaryStatus: 'published',
      })
      expect(await ids(svc, { q: 'lesson 1', courseId: 'c1', sort: 'title' })).not.toContain('k1')
      expect(await ids(svc, { archived: true, sort: 'date' })).toEqual(['k1', 'k3'])
    })

    // Proves an archived class refuses every change, and can't be archived twice.
    it('refuses changes to an archived class', async () => {
      const svc = service()
      await expect(svc.updateClass('k3', input())).rejects.toMatchObject({
        kind: 'validation',
        message: CLASS_ARCHIVED_MESSAGE,
      })
      await expect(svc.archiveClass('k3')).rejects.toMatchObject({
        kind: 'validation',
        message: 'This class is already archived.',
      })
    })

    // Proves archiving an unknown class is not found.
    it('rejects archiving an unknown class', async () => {
      await expect(service().archiveClass('nope')).rejects.toMatchObject({ kind: 'not_found' })
    })
  })
}
