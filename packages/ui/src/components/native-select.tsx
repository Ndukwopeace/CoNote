/**
 * The standard drop-down: a native <select> styled like Input. Native, so it works the same with
 * every keyboard, screen reader and phone picker.
 */

// React types.
import type * as React from 'react'

// Class-name helper.
import { cn } from '../utils'

/** A styled <select>. Accepts every normal select attribute; the options are its children. */
function NativeSelect({ className, ...props }: Readonly<React.ComponentProps<'select'>>) {
  return (
    <select
      // Marker for styling and debugging.
      data-slot="native-select"
      className={cn(
        // Size, border and background, matching Input; dimmed when disabled.
        'flex h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60',
        // Visible focus ring for keyboard users.
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        // Red outline when the field is marked invalid.
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        // Caller's extra classes last, so they win.
        className,
      )}
      // Everything else: name, value, onChange, aria-*…
      {...props}
    />
  )
}

// The component.
export { NativeSelect }
