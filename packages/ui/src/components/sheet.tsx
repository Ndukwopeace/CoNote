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
import { cn } from '../utils'

/** The sheet's state holder: wraps the trigger and the content. */
function Sheet(props: Readonly<React.ComponentProps<typeof SheetPrimitive.Root>>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

/** The button that opens the sheet. */
function SheetTrigger(props: Readonly<React.ComponentProps<typeof SheetPrimitive.Trigger>>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

/** Wraps anything that should close the sheet when clicked, such as a link inside it. */
function SheetClose(props: Readonly<React.ComponentProps<typeof SheetPrimitive.Close>>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

/** The dimmed backdrop behind the panel. Clicking it closes the sheet. */
function SheetOverlay({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Overlay>>) {
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
/** Where the sheet slides in from, with its size and animation. */
const SIDE_CLASSES = {
  // Full height on the right, three quarters wide up to 384 px.
  right:
    'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
  // Full width along the bottom, up to 85% of the screen tall, clear of the home indicator.
  bottom:
    'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
} as const

function SheetContent({
  className,
  children,
  // Right (the landing menu) or bottom (the summary's Ask AI on phones).
  side = 'right',
  // The close button's name for screen readers.
  closeLabel = 'Close menu',
  ...props
}: Readonly<
  React.ComponentProps<typeof SheetPrimitive.Content> & {
    side?: keyof typeof SIDE_CLASSES
    closeLabel?: string
  }
>) {
  return (
    // Rendered at the end of <body>, so no parent's overflow or stacking can clip it.
    <SheetPrimitive.Portal>
      {/* The backdrop. */}
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          // Shared: fixed above the page, a column, sliding in and out; then the side's own classes.
          'fixed z-50 flex flex-col gap-4 bg-surface p-6 shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500',
          SIDE_CLASSES[side],
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
          <span className="sr-only">{closeLabel}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

/** The sheet's title; Radix uses it as the dialog's accessible name. */
function SheetTitle({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Title>>) {
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
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Description>>) {
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
