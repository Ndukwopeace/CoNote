/**
 * A published summary, read-only (teacher REQUIREMENTS section 9): students may already have read
 * it, so there is no edit or publish action.
 */

// The four parts as text.
import { DraftSections } from './DraftSections'
// Wording.
import { formatDate } from '@/lib/format'
// The shape shown.
import type { ReviewDetails } from '@/types/review'

/** The published text, with who published it and when. */
export function PublishedDraft({ details }: Readonly<{ details: ReviewDetails }>) {
  return (
    <div className="space-y-8">
      {/* Who and when. */}
      <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success-strong">
        Published {formatDate(details.publishedAt)}
        {details.reviewedBy !== null && ` by ${details.reviewedBy}`}. It can no longer be edited.
      </p>
      {/* The text. */}
      <DraftSections draft={details.draft} />
    </div>
  )
}
