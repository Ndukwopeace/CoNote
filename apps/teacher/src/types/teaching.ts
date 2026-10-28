/**
 * What the My courses screen shows (teacher REQUIREMENTS section 6).
 */

// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'

/** One of the signed-in teacher's courses. */
export interface TeacherCourse {
  id: string
  code: string
  title: string
  // True while one of the course's classes is going on, the only time "Ongoing" is shown (D120).
  inSession: boolean
  // Classes in use (archived ones are not counted).
  classCount: number
  // Classes whose summary is in review: the teacher's turn.
  waitingForReviewCount: number
}

/** One class of a course, with where its summary is. */
export interface CourseClass {
  id: string
  number: number
  title: string
  startsAt: string
  // Notes students contributed (a count only).
  noteCount: number
  // The class's summary, or null if it has none yet.
  summaryId: string | null
  // Where the summary is; `collecting` when it has none yet.
  stage: SummaryStatus
  // When it was published, or null while unpublished.
  publishedAt: string | null
}

/** A course the teacher teaches, with its classes. */
export interface CourseDetails {
  id: string
  code: string
  title: string
  // True while one of the course's classes is going on, the only time "Ongoing" is shown (D120).
  inSession: boolean
  // Classes in use, newest first.
  classes: CourseClass[]
}
