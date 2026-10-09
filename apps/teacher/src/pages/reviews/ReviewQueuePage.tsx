/**
 * The review queue (teacher REQUIREMENTS section 8): the summaries waiting for the teacher.
 */

// The tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'

// The list.
import { ReviewQueueList } from '@/features/reviews/ReviewQueueList'

/** The review queue. */
export function ReviewQueuePage() {
  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Review queue" />
      {/* Page heading, and what the order means. */}
      <div>
        <h1 className="text-2xl font-bold">Review queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Summaries that have waited longest come first.
        </p>
      </div>
      {/* The summaries. */}
      <ReviewQueueList />
    </div>
  )
}
