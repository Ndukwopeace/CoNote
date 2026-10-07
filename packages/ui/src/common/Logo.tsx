/**
 * The CoNote logo, drawn in SVG so it stays sharp at any size and takes its colours from the
 * design tokens.
 */

// Class-name helper.
import { cn } from '../utils'

/** The CoNote mark and wordmark. `compact` shows only the mark. */
export function Logo({
  compact = false,
  className,
}: Readonly<{ compact?: boolean; className?: string }>) {
  return (
    // Mark and word side by side; callers can add or override classes.
    <span
      className={cn('inline-flex items-center gap-2 font-extrabold text-foreground', className)}
    >
      {/* The mark. Decorative, because the word "CoNote" next to it names the logo. */}
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0">
        {/* Rounded square in the brand colour. */}
        <rect width="32" height="32" rx="8" className="fill-primary" />
        {/* The open "C" stroke. */}
        <path
          d="M20.5 11.2a6.5 6.5 0 1 0 0 9.6"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-primary-foreground"
        />
        {/* The dot inside the C: many notes joining into one. */}
        <circle cx="22" cy="16" r="2" className="fill-primary-light" />
      </svg>
      {/* The word. In compact mode it is visually hidden but still read aloud. */}
      <span className={cn('text-xl tracking-tight', compact && 'sr-only')}>CoNote</span>
    </span>
  )
}
