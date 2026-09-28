/**
 * A navigation link that highlights itself on its own section, written to work inside Radix's
 * `asChild` wrappers.
 */

// Reads another component's prop types.
import type { ComponentProps } from 'react'
// Link navigates; useMatch and useResolvedPath work out whether the link is current.
import { Link, useMatch, useResolvedPath } from 'react-router'

// Class-name helper.
import { cn } from '@/lib/utils'

/** Link's props, but with plain-string class names instead of NavLink's function form. */
type SidebarLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  // Classes always applied.
  className?: string
  // Extra classes when the link is the current section.
  activeClassName?: string
}

/**
 * A nav link with a plain string className. NavLink's function className cannot pass through
 * Radix's Slot (used by TooltipTrigger asChild), which would turn it into text.
 */
export function SidebarLink({
  to,
  className,
  activeClassName,
  ...props
}: Readonly<SidebarLinkProps>) {
  // The link's full path, resolved against the current route.
  const resolved = useResolvedPath(to)
  // `end: false` also matches child pages, so "Notes" stays highlighted on /notes/n1.
  const isActive = useMatch({ path: resolved.pathname, end: false }) !== null

  return (
    <Link
      // Destination.
      to={to}
      // Tells screen readers which link is the current page.
      aria-current={isActive ? 'page' : undefined}
      // Base classes, plus the active ones when current.
      className={cn(className, isActive && activeClassName)}
      // Everything else, including props Radix injects for the tooltip.
      {...props}
    />
  )
}
