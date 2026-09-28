/**
 * Hover and focus tooltips (shadcn/ui new-york on Radix Tooltip). Radix handles the keyboard,
 * screen-reader and positioning details.
 */

// Radix's accessible tooltip parts.
import { Tooltip as TooltipPrimitive } from 'radix-ui'
// React types.
import * as React from 'react'

// Class-name helper.
import { cn } from '@/lib/utils'

/** Shared tooltip settings for the app. Rendered once in AppProviders. */
function TooltipProvider({
  // Show immediately; the icon rail needs labels without a wait.
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

/** One tooltip: wraps a trigger and its content. */
function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

/** The element that shows the tooltip on hover or keyboard focus. */
function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/** The tooltip bubble. */
function TooltipContent({
  className,
  // 4 px gap between the trigger and the bubble.
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    // Portal: rendered at the end of <body>, so it isn't clipped by scrolling containers.
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        // Dark bubble with light text; fades and zooms in and out.
        className={cn(
          'z-50 w-fit animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {/* The tooltip text. */}
        {children}
        {/* Small arrow pointing at the trigger. */}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

// All four parts.
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
