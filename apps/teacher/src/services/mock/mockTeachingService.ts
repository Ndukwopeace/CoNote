/**
 * The demo TeachingService (teacher REQUIREMENTS section 10): the signed-in teacher's courses,
 * counted from the demo platform records the way the database will count them.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'
// The shared vocabulary.
// Whether a class is going on now.
import { isInSession } from '@conote/core/inSession'

// The shape returned.
import type { CourseClass, CourseDetails, TeacherCourse } from '@/types/teaching'

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
  // The clock, so tests can pick the moment; the real one when absent (D120).
  now?: () => Date
}

/** What every "no such course" answers, whatever the reason, so the answer reveals nothing. */
const COURSE_NOT_FOUND = "We couldn't find that course."

/** Builds the demo TeachingService over `data`. */
export function createMockTeachingService({
  data,
  actorId,
  latencyMs,
  now = () => new Date(),
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
      return (
        mine
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
              inSession: isInSession(classes, now()),
              classCount: classes.length,
              waitingForReviewCount: data.summaries.filter(
                (summary) => classIds.has(summary.classId) && summary.status === 'in_review',
              ).length,
            }
          })
          // A course with a class going on comes first, then by code.
          .sort((a, b) => Number(b.inSession) - Number(a.inSession) || a.code.localeCompare(b.code))
      )
    },

    async getMyCourse(courseId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is asking.
      const teacherId = actorId()
      // SECURITY: no session, no course.
      if (teacherId === null) throw new AppError('unauthorized', 'Sign in to see this course.')
      // SECURITY: another teacher's, an archived and an unknown course all answer the same, so a
      // teacher can't find out which course IDs exist.
      const course = data.courses.find((candidate) => candidate.id === courseId)
      if (course?.teacherId !== teacherId || course.archivedAt !== null) {
        throw new AppError('not_found', COURSE_NOT_FOUND)
      }
      // The classes in use, newest first (the highest number is the latest).
      const classes = data.classes
        .filter((cls) => cls.courseId === course.id && cls.archivedAt === null)
        .sort((a, b) => b.number - a.number)
        .map((cls): CourseClass => {
          // The class's summary, if the pipeline has made one yet.
          const summary = data.summaries.find((candidate) => candidate.classId === cls.id)
          return {
            id: cls.id,
            number: cls.number,
            title: cls.title,
            startsAt: cls.startsAt,
            noteCount: cls.noteCount,
            summaryId: summary?.id ?? null,
            stage: summary?.status ?? 'collecting',
            publishedAt: summary?.publishedAt ?? null,
          }
        })
      return {
        id: course.id,
        code: course.code,
        title: course.title,
        inSession: isInSession(
          data.classes.filter((cls) => cls.courseId === course.id && cls.archivedAt === null),
          now(),
        ),
        classes,
      } satisfies CourseDetails
    },
  }
}
