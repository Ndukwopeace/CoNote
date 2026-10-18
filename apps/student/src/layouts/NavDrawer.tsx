/**
 * The phone drawer (D104): the shared navigation sliding in from the left, on Home and on every
 * other page.
 */

// Type for the navigation inside.
import type { ReactNode } from 'react'

// The slide-in panel parts.
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@conote/ui/sheet'

/** The drawer. */
export function NavDrawer({
  open,
  onOpenChange,
  children,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }>) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[min(20rem,85vw)] max-w-none p-0">
        {/* Names the dialog for screen readers; nothing to see. */}
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">
          Your classes, summaries, notes, courses and settings.
        </SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  )
}
