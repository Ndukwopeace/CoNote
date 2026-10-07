/**
 * The standard button (shadcn/ui new-york, adapted to CoNote's tokens). Every button in the
 * app uses this, so they look and behave the same.
 */

// cva builds class names from variant options; VariantProps derives their prop types.
import { cva, type VariantProps } from 'class-variance-authority'
// Slot lets the button pass its styles to a child element instead (the `asChild` option).
import { Slot } from 'radix-ui'
// React types.
import * as React from 'react'

// Class-name helper.
import { cn } from '../utils'

/** The button's classes, by variant and size. Exported so links can look like buttons. */
const buttonVariants = cva(
  // Base classes for every button: layout, text, focus ring (keyboard users can see where they
  // are), dimmed and unclickable when disabled, red outline when marked invalid, icon sizing.
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Main action: brand colour, darker on hover.
        default: 'bg-primary text-primary-foreground hover:bg-primary-dark',
        // Dangerous action, e.g. delete.
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30',
        // Secondary action with a border.
        outline: 'border bg-surface text-foreground hover:bg-accent hover:text-accent-foreground',
        // Soft brand tint.
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        // No background until hovered; used for icon buttons.
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        // Looks like a text link.
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // 40 px tall.
        default: 'h-10 px-4 py-2 has-[>svg]:px-3',
        // 32 px, for dense areas.
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        // 44 px, for hero calls to action.
        lg: 'h-11 rounded-md px-6 has-[>svg]:px-4',
        // Square, for icon-only buttons.
        icon: 'size-10',
      },
    },
    // Used when no variant or size is given.
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

/** A button. With `asChild`, the styles go to the child (e.g. a Link) instead of a <button>. */
function Button({
  // Extra classes from the caller.
  className,
  // Chosen look.
  variant,
  // Chosen size.
  size,
  // Render the child element instead of a <button>.
  asChild = false,
  // Every other button attribute (onClick, type, disabled, aria-*…).
  ...props
}: Readonly<
  React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>) {
  // Which element to render: Slot (merges into the child) or a real <button>.
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      // Marker for styling and debugging.
      data-slot="button"
      // Variant classes merged with the caller's.
      className={cn(buttonVariants({ variant, size, className }))}
      // Pass everything else through.
      {...props}
    />
  )
}

// The component, and its classes for non-button elements.
export { Button, buttonVariants }
