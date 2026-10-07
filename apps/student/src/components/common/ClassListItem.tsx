/**
 * One class in a list: course icon and code, class title, date and time, status badge. Used on
 * the dashboard, /classes and a course's Classes tab.
 */

// Chevron that shows the row opens something.
import { ChevronRight } from 'lucide-react'
// Type for the extra details slot.
import type { ReactNode } from 'react'
// Client-side link.
import { Link } from 'react-router'

// Date and time wording.
import { formatClassDate, formatClassTime } from '@/lib/dates'

// The course's tinted icon.
import { CourseIcon } from './CourseIcon'
// The status label.
import { StatusBadge } from './StatusBadge'

/** What a class row shows. */
interface ClassListItemProps {
  // The class page it opens.
  to: string
  // For the icon colour.
  courseId: string
  // e.g. "SWE 311". Left out inside a course, where every row would repeat it.
  courseCode?: string
  // The class title, prefixed with its number where given.
  title: string
  // Class number, shown as "4." before the title.
  number?: number
  // ISO start and end.
  startsAt: string
  endsAt: string
  // Live, upcoming or completed, from the clock.
  status: 'live' | 'upcoming' | 'completed'
  // Extra line, e.g. note count or "Summary available".
  details?: ReactNode
}

/** A list item holding one large link (the whole row is the target). */
export function ClassListItem({
  to,
  courseId,
  courseCode,
  title,
  number,
  startsAt,
  endsAt,
  status,
  details,
}: Readonly<ClassListItemProps>) {
  return (
    <li>
      {/* The whole row is one link, named by its text. */}
      <Link
        to={to}
        className="flex items-center gap-3 rounded-lg p-3 transition-colors outline-none hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {/* Course colour. */}
        <CourseIcon courseId={courseId} />
        {/* Text column; min-w-0 lets long titles truncate instead of pushing the badge out. */}
        <span className="min-w-0 flex-1">
          {/* Course code, when given. */}
          {courseCode && (
            <span className="block text-xs font-semibold text-muted-foreground">{courseCode}</span>
          )}
          {/* Class title, numbered where known. */}
          <span className="block truncate font-medium">
            {number === undefined ? title : `${String(number)}. ${title}`}
          </span>
          {/* Date and time. */}
          <span className="block text-sm text-muted-foreground">
            {formatClassDate(startsAt)} · {formatClassTime(startsAt, endsAt)}
          </span>
          {/* Extra details, when given. */}
          {details && <span className="mt-1 block text-xs text-muted-foreground">{details}</span>}
        </span>
        {/* Status. */}
        <StatusBadge status={status} />
        {/* Decorative chevron. */}
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  )
}
