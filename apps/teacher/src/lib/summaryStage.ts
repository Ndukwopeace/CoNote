/**
 * Where a summary is, in the teacher's words (teacher REQUIREMENTS section 7).
 */

// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'

/** Each summary stage in the teacher's words. */
const LABELS: Record<SummaryStatus, string> = {
  collecting: 'Collecting notes',
  processing: 'AI is drafting',
  in_review: 'Ready for your review',
  published: 'Published',
}

/** "Ready for your review" for `in_review`, and so on. */
export function stageLabel(stage: SummaryStatus): string {
  return LABELS[stage]
}

/** Whether the teacher can edit and publish a summary in `stage`: only in review. */
export function isEditable(stage: SummaryStatus): boolean {
  return stage === 'in_review'
}
