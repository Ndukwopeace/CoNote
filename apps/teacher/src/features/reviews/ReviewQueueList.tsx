/**
 * The review queue, longest wait first, with loading, empty and error states (teacher
 * REQUIREMENTS sections 8 and 11).
 */

// Icon for the empty state.
import { ClipboardCheck } from 'lucide-react'
// Client-side link.
import { Link } from 'react-router'

// Empty state and loading blocks.
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel.
import { ErrorState } from '@conote/portal'
// The queue.
import { useReviewQueue } from '@/hooks/useReview'
// Wording.
import { notesText, waitedText } from '@/lib/format'
// Where the review page is.
import { routeTo } from '@/lib/routes'

/** The list, or the state in its place. */
export function ReviewQueueList() {
  // The teacher's summaries in review.
  const { data, isPending, isError, refetch } = useReviewQueue()

  // Failed: the message and a retry.
  if (isError) return <ErrorState thing="the review queue" onRetry={() => void refetch()} />
  // First load: rows of blocks, announced once.
  if (isPending) {
    return (
      <output aria-label="Loading the review queue" className="block space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </output>
    )
  }
  // Nothing waiting.
  if (data.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="Nothing is waiting for your review." />
  }
  // One clock reading for every row.
  const now = new Date()
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {data.map((item) => (
        <li
          key={item.summaryId}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
        >
          {/* Which class, how long it has waited and how many notes are behind it. */}
          <div className="min-w-0">
            <p className="font-semibold">
              {item.courseCode} · Class {item.classNumber}: {item.classTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {waitedText(item.inReviewSince, now)} · {notesText(item.notesAnalyzedCount)}
            </p>
          </div>
          {/* Opens the review; named by class so each link is distinct for screen readers. */}
          <Link
            to={routeTo.review(item.summaryId)}
            aria-label={`Review ${item.courseCode} class ${String(item.classNumber)}`}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent"
          >
            Review
          </Link>
        </li>
      ))}
    </ul>
  )
}
