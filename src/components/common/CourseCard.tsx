/**
 * One course on My Courses (FR-CRS-1): icon, code, title, teacher, student count, status and a
 * chevron. The whole card is the link.
 */

// Icons: chevron to open, people for the count.
import { ChevronRight, Users } from 'lucide-react'
// Client-side link.
import { Link } from 'react-router'

// The course shape.
import type { Course } from '@/types/domain'

// The course's tinted icon.
import { CourseIcon } from './CourseIcon'
// The status label.
import { StatusBadge } from './StatusBadge'

/** A course card linking to `to`. */
export function CourseCard({ course, to }: Readonly<{ course: Course; to: string }>) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {/* Course colour. */}
      <CourseIcon courseId={course.id} />
      {/* Text column; min-w-0 lets long titles wrap inside the card. */}
      <span className="min-w-0 flex-1">
        {/* Code first, so the link's name starts with it ("SWE 311 …"). */}
        <span className="block text-xs font-semibold text-muted-foreground">
          {course.code}
        </span>{' '}
        {/* Title. */}
        <span className="block font-semibold">{course.title}</span>{' '}
        {/* Teacher and student count on one line. */}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{course.teacher.fullName}</span>{' '}
          <span className="inline-flex items-center gap-1">
            <Users aria-hidden="true" className="size-3.5" />
            {course.studentCount} students
          </span>
        </span>
      </span>
      {/* Term status. */}
      <StatusBadge status={course.status} />
      {/* Decorative chevron. */}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
