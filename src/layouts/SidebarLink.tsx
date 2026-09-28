import type { ComponentProps } from 'react'
import { Link, useMatch, useResolvedPath } from 'react-router'

import { cn } from '@/lib/utils'

type SidebarLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  className?: string
  activeClassName?: string
}

/**
 * A nav link with a plain string className. NavLink's function className cannot pass through
 * Radix's Slot (used by TooltipTrigger asChild), which would turn it into text.
 */
export function SidebarLink({ to, className, activeClassName, ...props }: SidebarLinkProps) {
  const resolved = useResolvedPath(to)
  const isActive = useMatch({ path: resolved.pathname, end: false }) !== null

  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className={cn(className, isActive && activeClassName)}
      {...props}
    />
  )
}
