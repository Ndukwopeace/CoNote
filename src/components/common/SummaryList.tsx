/**
 * A list of published summaries: class, who approved it and when, and a "Published" badge until
 * the student opens it. Used on Course Details and the Notes page.
 */

// Client-side link.
import { Link } from 'react-router'

// Relative times.
import { formatRelativeTime } from '@/lib/dates'
// Link builder.
import { routeTo } from '@/lib/routes'
// Shapes.
import type { ClassSession, Summary } from '@/types/domain'

// The status label.
import { StatusBadge } from './StatusBadge'

/** What the list needs. */
interface SummaryListProps {
  // The summaries, in display order.
  summaries: readonly Summary[]
  // Classes by ID, for titles.
  classById: ReadonlyMap<string, ClassSession>
  // Optional course code by course ID, shown before the class when the list spans courses.
  courseCodeById?: ReadonlyMap<string, string>
  // The current time.
  now: Date
}

/** One bordered list of summary links. */
export function SummaryList({
  summaries,
  classById,
  courseCodeById,
  now,
}: Readonly<SummaryListProps>) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {summaries.map((summary) => {
        // The summary's class and, when shown, its course code.
        const session = classById.get(summary.classId)
        const code = courseCodeById?.get(summary.courseId)
        return (
          <li key={summary.id}>
            {/* Opens the summary (the full view arrives in M5). */}
            <Link
              to={routeTo.summary(summary.courseId, summary.classId)}
              className="flex items-center gap-3 p-4 outline-none hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="min-w-0 flex-1">
                {/* Course code, when the list spans courses. */}
                {code && (
                  <span className="block text-xs font-semibold text-muted-foreground">{code}</span>
                )}{' '}
                {/* Class number and title. */}
                <span className="block font-medium">
                  {session ? `${String(session.number)}. ${session.title}` : 'Class summary'}
                </span>{' '}
                {/* Who approved it and when. */}
                <span className="block text-sm text-muted-foreground">
                  Approved by {summary.reviewedBy.fullName} ·{' '}
                  {formatRelativeTime(summary.publishedAt, now)}
                </span>
              </span>
              {/* Marked until the student opens it. */}
              {!summary.viewedByMe && <StatusBadge status="published" />}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
