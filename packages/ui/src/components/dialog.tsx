/**
 * A centred modal dialog (shadcn/ui new-york "Dialog" on Radix Dialog). Radix traps focus
 * inside while it is open, closes on Escape, and returns focus to whatever opened it.
 */

// Radix's accessible dialog parts.
import { Dialog as DialogPrimitive } from 'radix-ui'
// Close icon.
import { XIcon } from 'lucide-react'
// React types.
import * as React from 'react'

// Class-name helper.
import { cn } from '../utils'

/** The dialog's state holder. */
function Dialog(props: Readonly<React.ComponentProps<typeof DialogPrimitive.Root>>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

/** Wraps anything that should close the dialog when clicked. */
function DialogClose(props: Readonly<React.ComponentProps<typeof DialogPrimitive.Close>>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/** The dialog box, centred over a dimmed backdrop, with a close button in its corner. */
function DialogContent({
  className,
  children,
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Content>>) {
  return (
    // Rendered at the end of <body>, so no parent's overflow or stacking can clip it.
    <DialogPrimitive.Portal>
      {/* Translucent backdrop, fading in and out. Clicking it closes the dialog. */}
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Centred, 32 px narrower than the screen on phones, 448 px at most; zooms in and out.
          'fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      >
        {/* The caller's content. */}
        {children}
        {/* Close button in the top-right corner. */}
        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {/* Decorative icon. */}
          <XIcon aria-hidden="true" className="size-5" />
          {/* The button's name for screen readers. */}
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/** The dialog's title; Radix uses it as the dialog's accessible name. */
function DialogTitle({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Title>>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  )
}

/** A short description; Radix uses it as the dialog's accessible description. */
function DialogDescription({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Description>>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

// The parts.
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle }
