/**
 * A pulsing grey block that stands in for content while it loads (shadcn/ui new-york).
 */

// React types.
import type * as React from 'react'

// Class-name helper.
import { cn } from '@/lib/utils'

/** One placeholder block. Size it with classes. Decorative; the wrapper announces loading. */
function Skeleton({ className, ...props }: Readonly<React.ComponentProps<'div'>>) {
  return (
    <div
      // Marker for styling and debugging.
      data-slot="skeleton"
      // Hidden from screen readers; a Skeletons wrapper says "Loading…" once instead.
      aria-hidden="true"
      // Soft tint, rounded, pulsing (the pulse stops under reduced motion via globals.css).
      className={cn('animate-pulse rounded-md bg-accent', className)}
      // Everything else.
      {...props}
    />
  )
}

// The component.
export { Skeleton }
