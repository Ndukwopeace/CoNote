/**
 * Drop-down menus (shadcn/ui new-york on Radix DropdownMenu). Radix provides arrow-key
 * navigation, Escape to close, focus trapping and correct ARIA roles.
 */

// Radix's accessible menu parts.
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
// React types.
import * as React from 'react'

// Class-name helper.
import { cn } from '@/lib/utils'

/** One menu: holds the open/closed state. */
function DropdownMenu({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Root>>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

/** The button that opens the menu. */
function DropdownMenuTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

/** The menu panel. */
function DropdownMenuContent({
  className,
  // 4 px gap below the trigger.
  sideOffset = 4,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Content>>) {
  return (
    // Portal: rendered at the end of <body> so no container clips it.
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        // Panel look; scrolls if taller than the space available; animates from the trigger.
        className={cn(
          'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[10rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

/** Groups related items. */
function DropdownMenuGroup({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Group>>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

/** One menu item. `destructive` colours it red (e.g. Sign out). */
function DropdownMenuItem({
  className,
  // Indent to line up with items that have a check mark.
  inset,
  // Normal or red.
  variant = 'default',
  ...props
}: Readonly<
  React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
    variant?: 'default' | 'destructive'
  }
>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      // Exposed as data attributes so the classes below can react to them.
      data-inset={inset}
      data-variant={variant}
      // Row layout; highlighted when focused by keyboard or mouse; dimmed when disabled;
      // red variant; icon sizing and colour.
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-error-soft data-[variant=destructive]:focus:text-error-strong [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

/** A non-clickable heading inside the menu (e.g. the student's name). */
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: Readonly<
  React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)}
      {...props}
    />
  )
}

/** A thin dividing line between groups of items. */
function DropdownMenuSeparator({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Separator>>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

// Every part used by the app.
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
