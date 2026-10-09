/**
 * What the My courses screen shows (teacher REQUIREMENTS section 6).
 */

// The shared vocabulary.
import type { CourseStatus } from '@conote/domain'

/** One of the signed-in teacher's courses. */
export interface TeacherCourse {
  id: string
  code: string
  title: string
  status: CourseStatus
  // Classes in use (archived ones are not counted).
  classCount: number
  // Classes whose summary is in review: the teacher's turn.
  waitingForReviewCount: number
}
