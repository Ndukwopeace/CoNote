/**
 * A summary's stage as a tinted label. The words are always shown, so colour is never the only
 * signal (NFR-2).
 */

// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'
// The badge.
import { Badge } from '@conote/ui/badge'

// Stage wording.
import { stageLabel } from '@/lib/summaryStage'

/** The badge colour for each stage: the teacher's turn stands out. */
const VARIANTS = {
  collecting: 'outline',
  processing: 'secondary',
  in_review: 'warning',
  published: 'success',
} as const satisfies Record<SummaryStatus, string>

/** The stage label. */
export function StageBadge({ stage }: Readonly<{ stage: SummaryStatus }>) {
  return <Badge variant={VARIANTS[stage]}>{stageLabel(stage)}</Badge>
}
