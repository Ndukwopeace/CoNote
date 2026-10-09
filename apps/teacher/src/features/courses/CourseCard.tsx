/**
 * One of the teacher's courses as a card (teacher REQUIREMENTS section 6): code, title, status,
 * how many classes it has, and how many summaries wait for the teacher.
 */

// Client-side link.
import { Link } from 'react-router'

// The status label.
import { CourseStatusBadge } from '@/components/courses/CourseStatusBadge'
// Counts wording.
import { classesText } from '@/lib/format'
// Where the course page is.
import { routeTo } from '@/lib/routes'
// The shape shown.
import type { TeacherCourse } from '@/types/teaching'

/** A course card. */
export function CourseCard({ course }: Readonly<{ course: TeacherCourse }>) {
  return (
    <li className="rounded-xl border bg-card p-5 shadow-sm">
      {/* Code and status on one line; the title is the card's heading. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-primary-dark">{course.code}</p>
        <CourseStatusBadge status={course.status} />
      </div>
      <h2 className="mt-1 text-lg font-bold">
        {/* The title opens the course. */}
        <Link to={routeTo.course(course.id)} className="hover:underline">
          {course.title}
        </Link>
      </h2>
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
