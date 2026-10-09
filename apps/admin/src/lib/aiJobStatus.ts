/**
 * AI job status wording, the same on every screen.
 */

// The shared vocabulary.
import type { AiJobStatus } from '@conote/domain'

/** Each AI job status in words. */
const LABELS: Record<AiJobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
}

/** "Succeeded" for `succeeded`, and so on. */
export function aiJobStatusLabel(status: AiJobStatus): string {
  return LABELS[status]
}
