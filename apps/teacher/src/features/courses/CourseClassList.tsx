/**
 * A course's classes, newest first, each with where its summary is and, when the teacher can act,
 * a link to review or read it (teacher REQUIREMENTS section 7).
 */

// Icon for the empty state.
import { CalendarDays } from 'lucide-react'
// Client-side link.
import { Link } from 'react-router'

// Empty state.
import { EmptyState } from '@conote/ui/common/EmptyState'

// The stage label.
import { StageBadge } from '@/components/reviews/StageBadge'
// Wording.
import { formatDate, notesText } from '@/lib/format'
// Where the review page is.
import { routeTo } from '@/lib/routes'
// The shapes shown.
import type { CourseClass } from '@/types/teaching'

/** The link a class offers for its stage: review when it is the teacher's turn, view when published. */
function ClassAction({ cls }: Readonly<{ cls: CourseClass }>) {
  // Nothing to do before there is a draft, or without a summary.
  if (cls.summaryId === null || (cls.stage !== 'in_review' && cls.stage !== 'published')) {
    return null
  }
  const review = cls.stage === 'in_review'
  return (
    <Link
      to={routeTo.review(cls.summaryId)}
      // The class number in the name, so each link is distinct for screen readers.
      aria-label={`${review ? 'Review' : 'View'} class ${String(cls.number)}`}
      className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent"
    >
      {review ? 'Review' : 'View'}
    </Link>
  )
}

/** The list, or an empty state for a course with no classes yet. */
export function CourseClassList({ classes }: Readonly<{ classes: CourseClass[] }>) {
  // No classes: say so.
  if (classes.length === 0) {
    return <EmptyState icon={CalendarDays} title="This course has no classes yet." />
  }
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {classes.map((cls) => (
        <li
          key={cls.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
        >
          {/* Number, title, date and notes. */}
          <div className="min-w-0">
            <p className="font-semibold">
              Class {cls.number}: {cls.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(cls.startsAt)} · {notesText(cls.noteCount)}
              {/* The publish date, only once there is one. */}
              {cls.publishedAt !== null && ` · Published ${formatDate(cls.publishedAt)}`}
            </p>
          </div>
          {/* Stage and action. */}
          <div className="flex items-center gap-3">
            <StageBadge stage={cls.stage} />
            <ClassAction cls={cls} />
          </div>
        </li>
      ))}
    </ul>
  )
}
