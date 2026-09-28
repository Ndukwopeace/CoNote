import { NavLink } from 'react-router'

import { Logo } from '@/components/common/Logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { initials } from '@/lib/initials'
import { ROUTES } from '@/lib/routes'

import { NAV_ITEMS } from './navItems'
import { SidebarLink } from './SidebarLink'

/**
 * Desktop (≥ 1024 px): full sidebar with labels.
 * Tablet (768–1023 px): icon rail; labels move into tooltips but stay readable by screen readers.
 * Hidden on phones, where BottomNav takes over.
 */
export function Sidebar({ fullName }: { fullName: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r bg-surface md:flex lg:w-60">
      <NavLink
        to={ROUTES.dashboard}
        className="flex h-16 items-center justify-center rounded-md px-3 lg:justify-start lg:px-5"
      >
        <Logo compact className="lg:hidden" />
        <Logo className="hidden lg:inline-flex" />
      </NavLink>

      <nav aria-label="Main navigation" className="flex-1 px-2 py-4 lg:px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarLink
                    to={to}
                    className="flex h-11 items-center justify-center gap-3 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:justify-start lg:px-3"
                    activeClassName="bg-primary-light text-primary-dark"
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    <span className="sr-only lg:not-sr-only">{label}</span>
                  </SidebarLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="lg:hidden">
                  {label}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center justify-center gap-3 border-t p-3 lg:justify-start lg:px-5">
        <Avatar>
          <AvatarFallback>{initials(fullName)}</AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-semibold">{fullName}</p>
          <p className="text-xs text-muted-foreground">Student</p>
        </div>
      </div>
    </aside>
  )
}
