/**
 * The status label used on classes, courses and summaries (REQUIREMENTS.md 6.4).
 */

// The shared badge and its variant names.
import { Badge } from '@conote/ui/badge'

/** Every status a badge can show. */
export type BadgeStatus = 'live' | 'upcoming' | 'completed' | 'ongoing' | 'published' | 'in_review'

/** The text and colour for each status. Text is always present, so colour is never the only signal. */
const STATUS_STYLES = {
  // Happening now: green, with a dot.
  live: { label: 'Live', variant: 'success' },
  // Later: amber.
  upcoming: { label: 'Upcoming', variant: 'warning' },
  // Finished: neutral outline, so it recedes.
  completed: { label: 'Completed', variant: 'outline' },
  // A course in its term: brand tint.
  ongoing: { label: 'Ongoing', variant: 'secondary' },
  // A summary students can read: green.
  published: { label: 'Published', variant: 'success' },
  // A summary with the teacher: amber.
  in_review: { label: 'In review', variant: 'warning' },
} as const

/** A small coloured label for a status. */
export function StatusBadge({ status }: Readonly<{ status: BadgeStatus }>) {
  // The look for this status.
  const { label, variant } = STATUS_STYLES[status]
  return (
    <Badge variant={variant}>
      {/* A pulsing dot marks a live class; decorative, the word says it. */}
      {status === 'live' && (
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-success" />
      )}
      {/* The status in words. */}
      {label}
    </Badge>
  )
}
