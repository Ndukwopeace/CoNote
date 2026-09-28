import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

import { NAV_ITEMS } from './navItems'

/** Phone navigation (< 768 px): five destinations within thumb reach. */
export function BottomNav() {
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.filter((item) => item.inBottomBar).map(({ label, to, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground',
                  isActive && 'text-primary',
                )
              }
            >
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
