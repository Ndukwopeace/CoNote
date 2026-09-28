import { cn } from '@/lib/utils'

/** The CoNote mark and wordmark. `compact` shows only the mark. */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-2 font-extrabold text-foreground', className)}
    >
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0">
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M20.5 11.2a6.5 6.5 0 1 0 0 9.6"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-primary-foreground"
        />
        <circle cx="22" cy="16" r="2" className="fill-primary-light" />
      </svg>
      <span className={cn('text-xl tracking-tight', compact && 'sr-only')}>CoNote</span>
    </span>
  )
}
