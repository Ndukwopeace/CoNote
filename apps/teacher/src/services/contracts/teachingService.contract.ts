/**
 * The rules every TeachingService implementation must follow, run against the demo now and the
 * Supabase service later (ENGINEERING_STANDARDS.md 2.4).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The records a test builds.
import {
  classRecord,
  courseRecord,
  emptyPlatformData,
  summaryRecord,
  type PlatformData,
} from '../platformData'
// The interface under test.
import type { TeachingService } from '../types'

/** The start and end of a class that begins `fromMinutes` from now and ends `toMinutes` from now. */
function around(fromMinutes: number, toMinutes: number) {
  const now = Date.now()
  return {
    startsAt: new Date(now + fromMinutes * 60_000).toISOString(),
    endsAt: new Date(now + toMinutes * 60_000).toISOString(),
  }
}

/** Builds a service over `data`, acting as the teacher with ID `actorId` (null: signed out). */
export type TeachingServiceFactory = (data: PlatformData, actorId: string | null) => TeachingService

/** Registers the contract's tests for the implementation `create` builds. */
export function describeTeachingServiceContract(name: string, create: TeachingServiceFactory) {
  describe(`TeachingService contract (${name})`, () => {
    // Proves a teacher sees only the courses they teach (teacher REQUIREMENTS section 2).
    it('lists only the signed-in teacher’s courses', async () => {
      const data = emptyPlatformData({
        courses: [
          courseRecord({ id: 'mine', teacherId: 't1' }),
          courseRecord({ id: 'theirs', teacherId: 't2' }),
          courseRecord({ id: 'nobodys', teacherId: null }),
        ],
      })
      const courses = await create(data, 't1').listMyCourses()
      expect(courses.map((course) => course.id)).toEqual(['mine'])
    })

    // Proves archived courses disappear from the list but are never deleted.
    it('leaves archived courses out', async () => {
      const data = emptyPlatformData({
        courses: [
          courseRecord({ id: 'live', teacherId: 't1' }),
          courseRecord({ id: 'old', teacherId: 't1', archivedAt: '2026-01-01T00:00:00.000Z' }),
        ],
      })
      const courses = await create(data, 't1').listMyCourses()
      expect(courses.map((course) => course.id)).toEqual(['live'])
    })

    // Proves a course says it is in session only while one of its classes is going on, and a
    // course with a class going on comes first, by code within each group (D120).
    it('puts courses with a class going on first, then by code', async () => {
      const data = emptyPlatformData({
        courses: [
          courseRecord({ id: 'a', code: 'A 100', teacherId: 't1' }),
          courseRecord({ id: 'b', code: 'B 100', teacherId: 't1' }),
          courseRecord({ id: 'c', code: 'C 100', teacherId: 't1' }),
        ],
        classes: [
          // Going on now (started half an hour ago, ends in half an hour).
          classRecord({ id: 'live', courseId: 'c', ...around(-30, 30) }),
          // Finished this morning, and still to come tomorrow.
          classRecord({ id: 'done', courseId: 'a', number: 1, ...around(-300, -240) }),
          classRecord({ id: 'later', courseId: 'a', number: 2, ...around(1_440, 1_500) }),
        ],
      })
      const courses = await create(data, 't1').listMyCourses()
      expect(courses.map((course) => [course.id, course.inSession])).toEqual([
        ['c', true],
        ['a', false],
        ['b', false],
      ])
      // No other status is given: nothing about "upcoming" or "completed" can go out of date.
      expect(courses.every((course) => !('status' in course))).toBe(true)
    })

    // Proves the counts: classes in use, and summaries waiting in review. Archived classes and
    // other stages don't count.
    it('counts classes and summaries waiting for review', async () => {
      const data = emptyPlatformData({
        courses: [courseRecord({ id: 'c1', teacherId: 't1' })],
        classes: [
          classRecord({ id: 'k1', courseId: 'c1', number: 1 }),
          classRecord({ id: 'k2', courseId: 'c1', number: 2 }),
          classRecord({ id: 'k3', courseId: 'c1', number: 3 }),
          classRecord({
            id: 'k4',
            courseId: 'c1',
            number: 4,
            archivedAt: '2026-01-01T00:00:00.000Z',
          }),
          classRecord({ id: 'other', courseId: 'c2', number: 1 }),
        ],
        summaries: [
          summaryRecord({ id: 's1', classId: 'k1', status: 'in_review' }),
          summaryRecord({ id: 's2', classId: 'k2', status: 'published' }),
          summaryRecord({ id: 's3', classId: 'k3', status: 'processing' }),
          summaryRecord({ id: 's4', classId: 'k4', status: 'in_review' }),
          summaryRecord({ id: 's5', classId: 'other', status: 'in_review' }),
        ],
      })
      const [course] = await create(data, 't1').listMyCourses()
      expect(course).toMatchObject({ id: 'c1', classCount: 3, waitingForReviewCount: 1 })
    })

    // Proves a teacher with no courses gets an empty list, not an error.
    it('returns an empty list for a teacher with no courses', async () => {
      await expect(create(emptyPlatformData(), 't1').listMyCourses()).resolves.toEqual([])
    })

    // SECURITY: proves a signed-out caller gets nothing, however the records look.
    it('refuses a signed-out caller', async () => {
      const data = emptyPlatformData({ courses: [courseRecord({ id: 'c1', teacherId: 't1' })] })
      await expect(create(data, null).listMyCourses()).rejects.toMatchObject({
        kind: 'unauthorized',
      })
    })

    describe('getMyCourse', () => {
      // Proves a course comes back with its classes, newest first, each with its stage.
      it('returns the course with its classes, newest first', async () => {
        const data = emptyPlatformData({
          courses: [courseRecord({ id: 'c1', code: 'C 1', title: 'Course one', teacherId: 't1' })],
          classes: [
            classRecord({ id: 'k1', courseId: 'c1', number: 1, noteCount: 4 }),
            classRecord({ id: 'k2', courseId: 'c1', number: 2 }),
            classRecord({
              id: 'k3',
              courseId: 'c1',
              number: 3,
              archivedAt: '2026-01-01T00:00:00.000Z',
            }),
          ],
          summaries: [
            summaryRecord({
              id: 's1',
              classId: 'k1',
              status: 'published',
              publishedAt: '2026-09-12T10:00:00.000Z',
            }),
            summaryRecord({ id: 's2', classId: 'k2', status: 'in_review' }),
          ],
        })
        const course = await create(data, 't1').getMyCourse('c1')
        expect(course).toMatchObject({
          id: 'c1',
          code: 'C 1',
          title: 'Course one',
          inSession: false,
        })
        // Archived class left out; newest (highest number) first.
        expect(course.classes.map((cls) => cls.id)).toEqual(['k2', 'k1'])
        expect(course.classes[0]).toMatchObject({
          summaryId: 's2',
          stage: 'in_review',
          publishedAt: null,
        })
        expect(course.classes[1]).toMatchObject({
          summaryId: 's1',
          stage: 'published',
          noteCount: 4,
          publishedAt: '2026-09-12T10:00:00.000Z',
        })
      })

      // Proves a class with no summary record yet reads as still collecting.
      it('treats a class without a summary as collecting', async () => {
        const data = emptyPlatformData({
          courses: [courseRecord({ id: 'c1', teacherId: 't1' })],
          classes: [classRecord({ id: 'k1', courseId: 'c1' })],
        })
        const course = await create(data, 't1').getMyCourse('c1')
        expect(course.classes[0]).toMatchObject({ summaryId: null, stage: 'collecting' })
      })

      // SECURITY: proves another teacher's, an archived and an unknown course all answer the same
      // not_found, so the answer doesn't reveal which exist.
      it('answers not_found for any course that is not the teacher’s own and live', async () => {
        const data = emptyPlatformData({
          courses: [
            courseRecord({ id: 'theirs', teacherId: 't2' }),
            courseRecord({ id: 'old', teacherId: 't1', archivedAt: '2026-01-01T00:00:00.000Z' }),
          ],
        })
        for (const id of ['theirs', 'old', 'nope']) {
          await expect(create(data, 't1').getMyCourse(id)).rejects.toMatchObject({
            kind: 'not_found',
          })
        }
      })

      // SECURITY: proves a signed-out caller gets nothing.
      it('refuses a signed-out caller', async () => {
        const data = emptyPlatformData({ courses: [courseRecord({ id: 'c1', teacherId: 't1' })] })
        await expect(create(data, null).getMyCourse('c1')).rejects.toMatchObject({
          kind: 'unauthorized',
        })
      })
    })
  })
}
