/**
 * Small status label (shadcn/ui new-york). CoNote's status variants pair a pale tint with dark
 * text, because the raw success and warning colours are too faint for small text
 * (REQUIREMENTS.md 6.1).
 */

// Variant class builder and its prop types.
import { cva, type VariantProps } from 'class-variance-authority'
// Lets the badge style a child element instead (`asChild`).
import { Slot } from 'radix-ui'
// React types.
import * as React from 'react'

// Class-name helper.
import { cn } from '@/lib/utils'

/** The badge's classes, by variant. */
const badgeVariants = cva(
  // Base: small pill shape, bold text, icon sizing.
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        // Solid brand colour.
        default: 'border-transparent bg-primary text-primary-foreground',
        // Soft brand tint.
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        // Published, Live: pale green with dark green text (readable at small sizes).
        success: 'border-transparent bg-success-soft text-success-strong',
        // Upcoming, In review: pale amber with dark amber text.
        warning: 'border-transparent bg-warning-soft text-warning-strong',
        // Errors: pale red with dark red text.
        destructive: 'border-transparent bg-error-soft text-error-strong',
        // Border only.
        outline: 'text-foreground',
      },
    },
    // Used when no variant is given.
    defaultVariants: {
      variant: 'default',
    },
  },
)

/** A status badge. Always carries text, so colour is never the only signal (NFR-2). */
function Badge({
  // Extra classes.
  className,
  // Chosen look.
  variant,
  // Style a child element instead of a <span>.
  asChild = false,
  // Every other span attribute.
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  // Slot or a real <span>.
  const Comp = asChild ? Slot.Root : 'span'

  // Render with the variant classes plus the caller's.
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

// The component and its classes.
export { Badge, badgeVariants }
