/**
 * A panel that slides in from the edge of the screen (shadcn/ui new-york "Sheet" on Radix
 * Dialog). Used for the landing page's phone menu. Radix traps focus inside while it is open,
 * closes on Escape, and returns focus to the button that opened it.
 */

// Radix's accessible dialog parts.
import { Dialog as SheetPrimitive } from 'radix-ui'
// Close icon.
import { XIcon } from 'lucide-react'
// React types.
import * as React from 'react'

// Class-name helper.
import { cn } from '@/lib/utils'

/** The sheet's state holder: wraps the trigger and the content. */
function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

/** The button that opens the sheet. */
function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

/** Wraps anything that should close the sheet when clicked, such as a link inside it. */
function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

/** The dimmed backdrop behind the panel. Clicking it closes the sheet. */
function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        // Covers the screen with a translucent black layer, fading in and out.
        'fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

/** The panel itself, from the right edge, with a close button in its corner. */
function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    // Rendered at the end of <body>, so no parent's overflow or stacking can clip it.
    <SheetPrimitive.Portal>
      {/* The backdrop. */}
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          // Full height on the right, three quarters wide up to 384 px, sliding in and out.
          'fixed inset-y-0 right-0 z-50 flex h-full w-3/4 max-w-sm flex-col gap-4 border-l bg-surface p-6 shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:duration-500 data-[state=open]:slide-in-from-right',
          className,
        )}
        {...props}
      >
        {/* The caller's content. */}
        {children}
        {/* Close button in the top-right corner. */}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {/* Decorative icon. */}
          <XIcon aria-hidden="true" className="size-5" />
          {/* The button's name for screen readers. */}
          <span className="sr-only">Close menu</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

/** The sheet's title; Radix uses it as the dialog's accessible name. */
function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  )
}

/** A short description; Radix uses it as the dialog's accessible description. */
function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

// The parts.
export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger }
