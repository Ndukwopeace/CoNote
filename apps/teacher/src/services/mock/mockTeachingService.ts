/**
 * The demo TeachingService (teacher REQUIREMENTS section 10): the signed-in teacher's courses,
 * counted from the demo platform records the way the database will count them.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'
// The shared vocabulary.
import type { CourseStatus } from '@conote/domain'

// The shape returned.
import type { TeacherCourse } from '@/types/teaching'

// The records it reads.
import type { PlatformData } from '../platformData'
// The interface implemented here.
import type { TeachingService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'

/** What the demo service needs: the records, who is signed in, and how slow to pretend to be. */
interface MockTeachingOptions {
  data: PlatformData
  // The signed-in teacher's ID, or null when signed out.
  actorId: () => string | null
  latencyMs: number
}

/** Where each status sorts: ongoing courses are the ones being taught now. */
const STATUS_ORDER: Record<CourseStatus, number> = { ongoing: 0, upcoming: 1, completed: 2 }

/** Builds the demo TeachingService over `data`. */
export function createMockTeachingService({
  data,
  actorId,
  latencyMs,
}: MockTeachingOptions): TeachingService {
  return {
    async listMyCourses() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is asking.
      const teacherId = actorId()
      // SECURITY: no session, no courses, whatever the records hold.
      if (teacherId === null) throw new AppError('unauthorized', 'Sign in to see your courses.')
      // SECURITY: only courses this teacher teaches, and none that are archived.
      const mine = data.courses.filter(
        (course) => course.teacherId === teacherId && course.archivedAt === null,
      )
      return mine
        .map((course): TeacherCourse => {
          // The course's classes in use.
          const classes = data.classes.filter(
            (cls) => cls.courseId === course.id && cls.archivedAt === null,
          )
          // Their IDs, to find the summaries waiting in review.
          const classIds = new Set(classes.map((cls) => cls.id))
          return {
            id: course.id,
            code: course.code,
            title: course.title,
            status: course.status,
            classCount: classes.length,
            waitingForReviewCount: data.summaries.filter(
              (summary) => classIds.has(summary.classId) && summary.status === 'in_review',
            ).length,
          }
        })
        .sort(
          (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.code.localeCompare(b.code),
        )
    },
  }
}
