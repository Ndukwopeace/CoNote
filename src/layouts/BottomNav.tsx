/**
 * The phone navigation bar fixed to the bottom of the screen.
 */

// NavLink knows whether it points at the current page.
import { NavLink } from 'react-router'

// Class-name helper.
import { cn } from '@/lib/utils'

// The shared list of destinations.
import { NAV_ITEMS } from './navItems'

/** Phone navigation (< 768 px): five destinations within thumb reach. */
export function BottomNav() {
  return (
    // A distinct name, so screen readers can tell it apart from the sidebar's navigation.
    // Fixed to the bottom; the safe-area padding keeps it above the iPhone home indicator;
    // hidden from 768 px up, where the sidebar takes over.
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {/* Five equal columns. */}
      <ul className="grid grid-cols-5">
        {/* Only items marked for the bottom bar (Settings lives in the avatar menu on phones). */}
        {NAV_ITEMS.filter((item) => item.inBottomBar).map(({ label, to, icon: Icon }) => (
          // The route is unique, so it doubles as React's key.
          <li key={to}>
            {/* NavLink sets aria-current="page" on the current destination automatically. */}
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  // At least 56 px tall, above the 44 px touch-target minimum (NFR-1).
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground',
                  // The current destination is highlighted in brand colour.
                  isActive && 'text-primary',
                )
              }
            >
              {/* Icon, hidden from screen readers because the label says the same thing. */}
              <Icon aria-hidden="true" className="size-5" />
              {/* The visible label, which is also the link's accessible name. */}
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
