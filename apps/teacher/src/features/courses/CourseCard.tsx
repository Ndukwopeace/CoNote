/**
 * One of the teacher's courses as a card (teacher REQUIREMENTS section 6): code, title, status,
 * how many classes it has, and how many summaries wait for the teacher.
 */

// The status label.
import { CourseStatusBadge } from '@/components/courses/CourseStatusBadge'
// The shape shown.
import type { TeacherCourse } from '@/types/teaching'

/** "1 class", "3 classes". */
function classesText(count: number): string {
  return count === 1 ? '1 class' : `${String(count)} classes`
}

/** A course card. */
export function CourseCard({ course }: Readonly<{ course: TeacherCourse }>) {
  return (
    <li className="rounded-xl border bg-card p-5 shadow-sm">
      {/* Code and status on one line; the title is the card's heading. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-primary-dark">{course.code}</p>
        <CourseStatusBadge status={course.status} />
      </div>
      <h2 className="mt-1 text-lg font-bold">{course.title}</h2>
      {/* The counts. */}
      <p className="mt-3 text-sm text-muted-foreground">{classesText(course.classCount)}</p>
      {/* The teacher's turn, said only when there is one. The text carries the meaning, not colour. */}
      {course.waitingForReviewCount > 0 && (
        <p className="mt-1 text-sm font-semibold text-warning-strong">
          {course.waitingForReviewCount} waiting for review
        </p>
      )}
    </li>
  )
}
