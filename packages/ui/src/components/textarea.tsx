/**
 * The standard multi-line text box (shadcn/ui new-york, adapted to CoNote's tokens).
 */

// React types.
import * as React from 'react'

// Class-name helper.
import { cn } from '../utils'

/** A styled <textarea>. Accepts every normal textarea attribute. */
function Textarea({ className, ...props }: Readonly<React.ComponentProps<'textarea'>>) {
  return (
    <textarea
      // Marker for styling and debugging.
      data-slot="textarea"
      className={cn(
        // Size, border, background and placeholder colour; dimmed when disabled.
        'flex min-h-24 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60',
        // Visible focus ring for keyboard users.
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        // Red outline when the field is marked invalid.
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        // Caller's extra classes last, so they win.
        className,
      )}
      // Everything else: name, value, onChange, rows, aria-*…
      {...props}
    />
  )
}

// The component.
export { Textarea }
