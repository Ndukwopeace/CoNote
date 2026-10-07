/**
 * Tabs (shadcn/ui new-york on Radix Tabs). Radix provides the tablist roles and arrow-key
 * movement between tabs.
 */

// Radix's accessible tab parts.
import { Tabs as TabsPrimitive } from 'radix-ui'
// React types.
import type * as React from 'react'

// Class-name helper.
import { cn } from '../utils'

/** The tab set; holds which tab is selected. */
function Tabs({ className, ...props }: Readonly<React.ComponentProps<typeof TabsPrimitive.Root>>) {
  return (
    <TabsPrimitive.Root
      // Marker for styling and debugging.
      data-slot="tabs"
      // Tabs above panels.
      className={cn('flex flex-col gap-4', className)}
      // Everything else.
      {...props}
    />
  )
}

/** The row of tab buttons. Scrolls sideways on narrow phones rather than wrapping. */
function TabsList({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof TabsPrimitive.List>>) {
  return (
    <TabsPrimitive.List
      // Marker for styling and debugging.
      data-slot="tabs-list"
      // Underlined row that scrolls horizontally when it doesn't fit.
      className={cn('flex w-full gap-1 overflow-x-auto border-b', className)}
      // Everything else.
      {...props}
    />
  )
}

/** One tab button. The selected one is bold and underlined, so it isn't shown by colour alone. */
function TabsTrigger({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof TabsPrimitive.Trigger>>) {
  return (
    <TabsPrimitive.Trigger
      // Marker for styling and debugging.
      data-slot="tabs-trigger"
      // 44 px tall touch target; selected: brand underline and bolder text; visible focus ring.
      className={cn(
        '-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-foreground',
        className,
      )}
      // Everything else.
      {...props}
    />
  )
}

/** One tab's panel. */
function TabsContent({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof TabsPrimitive.Content>>) {
  return (
    <TabsPrimitive.Content
      // Marker for styling and debugging.
      data-slot="tabs-content"
      // Visible focus ring when the panel itself is focused with Tab.
      className={cn(
        'rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      // Everything else.
      {...props}
    />
  )
}

// The parts.
export { Tabs, TabsContent, TabsList, TabsTrigger }
