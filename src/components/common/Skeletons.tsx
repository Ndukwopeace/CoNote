/**
 * Loading placeholders shaped like the content they stand in for (REQUIREMENTS.md section 11).
 * The grey blocks are hidden from screen readers; one "Loading…" is announced per view instead.
 */

// Type for the wrapper's children.
import type { ReactNode } from 'react'

// The pulsing block.
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Wraps placeholder shapes. `announce` adds the spoken "Loading…"; a view that shows two shapes
 * announces with only one of them, so screen readers hear it once.
 */
function Placeholder({
  announce,
  className,
  children,
}: Readonly<{ announce: boolean; className: string; children: ReactNode }>) {
  // Announcing: <output> is a polite live region, so the words are read without interrupting.
  if (announce) {
    return (
      <output className={className}>
        <span className="sr-only">Loading…</span>
        {children}
      </output>
    )
  }
  // Silent: shapes only.
  return <div className={className}>{children}</div>
}

/** Rows shaped like class or note list items. */
export function ListSkeleton({
  rows = 3,
  announce = true,
}: Readonly<{ rows?: number; announce?: boolean }>) {
  return (
    <Placeholder announce={announce} className="block space-y-3">
      {/* One row per expected item: an icon square and two text lines. */}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <Skeleton className="size-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </Placeholder>
  )
}

/** Cards in a grid, shaped like stat cards. */
export function CardGridSkeleton({
  count = 4,
  announce = true,
}: Readonly<{ count?: number; announce?: boolean }>) {
  return (
    <Placeholder announce={announce} className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {/* One card per expected item. */}
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </Placeholder>
  )
}

/** A page header: a short line, a big title and a detail line. */
export function HeaderSkeleton({ announce = true }: Readonly<{ announce?: boolean }>) {
  return (
    <Placeholder announce={announce} className="block space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </Placeholder>
  )
}
