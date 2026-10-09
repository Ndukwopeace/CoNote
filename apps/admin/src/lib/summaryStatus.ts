/**
 * Summary stage wording for the course screens.
 */

// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'

/** Each summary stage in words. */
const LABELS: Record<SummaryStatus, string> = {
  collecting: 'Collecting notes',
  processing: 'Processing',
  in_review: 'In review',
  published: 'Published',
}

/** "In review" for `in_review`, and so on; "No summary yet" for a class without one. */
export function summaryStatusLabel(status: SummaryStatus | null): string {
  return status === null ? 'No summary yet' : LABELS[status]
}
