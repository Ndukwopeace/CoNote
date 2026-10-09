/**
 * The "Preview" label for a feature that shows example content while its real service is being
 * built (the "nothing fake" rule, admin REQUIREMENTS section 23).
 */

// Class-name helper.
import { cn } from '@conote/ui/utils'
// The shared pill.
import { Badge } from '@conote/ui/badge'

/** A small amber "Preview" pill. The text is real, so colour is never the only signal (NFR-2). */
export function PreviewBadge({ className }: Readonly<{ className?: string }>) {
  return (
    // Warning tint with dark text, as the other status labels. Small, so it fits the nav.
    <Badge variant="warning" className={cn('px-1.5 py-0 text-[10px] leading-4', className)}>
      Preview
    </Badge>
  )
}
