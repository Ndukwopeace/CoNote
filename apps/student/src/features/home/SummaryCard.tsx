/**
 * The teacher-approved summary, arriving in the Home stream after class (D102).
 */

// Client-side links.
import { Link } from 'react-router'

// Standard button styles.
import { Button } from '@conote/ui/button'
// Addresses.
import { routeTo } from '@/lib/routes'
// Shape.
import type { Summary } from '@/types/domain'

/** The summary card for the class named by `title`. */
export function SummaryCard({
  summary,
  title,
  onAsk,
}: Readonly<{ summary: Summary; title: string; onAsk: () => void }>) {
  return (
    <section
      aria-label="Summary ready"
      className="w-full space-y-2.5 rounded-3xl border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wide text-primary-dark uppercase">
          Summary ready
        </span>
        <span className="text-xs text-muted-foreground">
          Reviewed by {summary.reviewedBy.fullName}
        </span>
      </div>
      <h2 className="text-lg leading-snug font-semibold">{title}</h2>
      {/* The overview, as text. */}
      <p className="line-clamp-4 text-sm leading-relaxed">{summary.overview}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild>
          <Link to={routeTo.summary(summary.courseId, summary.classId)}>Read full summary</Link>
        </Button>
        <Button type="button" variant="outline" onClick={onAsk}>
          Ask about this
        </Button>
      </div>
    </section>
  )
}
