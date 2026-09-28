/**
 * What the Class page says about its summary at each stage (REQUIREMENTS.md section 4).
 */

// The summary stages.
import type { SummaryStatus } from '@/types/domain'

/** A title and one sentence for the summary state card. */
export interface SummaryStateMessage {
  // Card heading.
  title: string
  // One-sentence explanation.
  message: string
}

/** The wording for each stage. Draft content is never shown, only the stage (section 4). */
export function summaryStateMessage(status: SummaryStatus): SummaryStateMessage {
  switch (status) {
    // Notes are still being written.
    case 'collecting':
      return { title: 'Summary not available yet', message: 'Add your notes to contribute.' }
    // The AI is working on it.
    case 'processing':
      return { title: 'Summary in progress', message: 'CoNote AI is analysing class notes.' }
    // Waiting for the teacher.
    case 'in_review':
      return { title: 'Summary in review', message: 'Your teacher is reviewing the summary.' }
    // Approved and readable.
    case 'published':
      return {
        title: 'Summary available',
        message: 'Your teacher has approved the summary for this class.',
      }
  }
}
