/**
 * A class's summary stage as a tinted label (admin REQUIREMENTS section 21, StatusBadge). The
 * word is always shown, so colour is never the only signal.
 */

// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'
// The badge.
import { Badge } from '@conote/ui/badge'

// Stage wording.
import { summaryStatusLabel } from '@/lib/summaryStatus'

/** The badge colour for each stage. */
const VARIANTS = {
  collecting: 'outline',
  processing: 'outline',
  in_review: 'warning',
  published: 'success',
} as const satisfies Record<SummaryStatus, string>

/** The stage label, or "No summary yet". */
export function SummaryStatusBadge({ status }: Readonly<{ status: SummaryStatus | null }>) {
  return <Badge variant={status ? VARIANTS[status] : 'outline'}>{summaryStatusLabel(status)}</Badge>
}
