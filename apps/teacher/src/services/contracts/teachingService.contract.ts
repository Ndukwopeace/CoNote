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

    // Proves ongoing courses come first, then upcoming, then completed, by code within each.
    it('orders by status, then code', async () => {
      const data = emptyPlatformData({
        courses: [
          courseRecord({ id: 'c', code: 'C 100', status: 'completed', teacherId: 't1' }),
          courseRecord({ id: 'u', code: 'U 100', status: 'upcoming', teacherId: 't1' }),
          courseRecord({ id: 'o2', code: 'O 200', status: 'ongoing', teacherId: 't1' }),
          courseRecord({ id: 'o1', code: 'O 100', status: 'ongoing', teacherId: 't1' }),
        ],
      })
      const courses = await create(data, 't1').listMyCourses()
      expect(courses.map((course) => course.id)).toEqual(['o1', 'o2', 'u', 'c'])
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
  })
}
