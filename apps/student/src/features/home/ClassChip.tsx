/**
 * The class a note will be filed under, shown above the composer as a chip (D102). Tapping it
 * opens the class sheet. While a note is edited it stays put: a note cannot be moved to another
 * class by accident.
 */

// Icon.
import { ChevronDown } from 'lucide-react'

// Class-name helper.
import { cn } from '@conote/ui/utils'

/** The chip: `label` is "SWE 311 · SDLC Models", or null when no class is chosen yet. */
export function ClassChip({
  label,
  live,
  onClick,
  disabled = false,
}: Readonly<{ label: string | null; live: boolean; onClick: () => void; disabled?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label ? `Class: ${label}.${disabled ? '' : ' Change'}` : 'Choose a class'}
      className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:border-border"
    >
      {/* A green dot while the class is on. */}
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', live ? 'bg-success' : 'bg-muted-foreground')}
      />
      {label ?? 'Choose a class'}
      {!disabled && <ChevronDown aria-hidden="true" className="size-4" />}
    </button>
  )
}
