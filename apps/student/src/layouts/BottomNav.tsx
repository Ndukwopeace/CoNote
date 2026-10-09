/**
 * The phone navigation bar fixed to the bottom of the screen.
 */

// NavLink knows whether it points at the current page.
import { NavLink } from 'react-router'

// Class-name helper.
import { cn } from '@conote/ui/utils'

// The "Preview" label.
import { PreviewBadge } from '@/components/common/PreviewBadge'
// The shared list of destinations.
import { NAV_ITEMS } from './navItems'

/** Phone navigation (< 768 px): four destinations within thumb reach (decision D35). */
export function BottomNav() {
  return (
    // A distinct name, so screen readers can tell it apart from the sidebar's navigation.
    // Fixed to the bottom. The safe-area padding keeps it clear of the iPhone home indicator at
    // the bottom and the notch at the sides in landscape. Hidden from 768 px up.
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] md:hidden"
    >
      {/* Four equal columns: about 98 px each on a 390 px phone, room for every label. */}
      <ul className="grid grid-cols-4">
        {/* Only items marked for the bottom bar. */}
        {NAV_ITEMS.filter((item) => item.inBottomBar).map(({ label, to, icon: Icon, preview }) => (
          // The route is unique, so it doubles as React's key.
          <li key={to}>
            {/* NavLink sets aria-current="page" on the current destination automatically. */}
            <NavLink
              to={to}
              // At least 56 px tall, above the 44 px touch-target minimum (NFR-1).
              className="group flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] text-muted-foreground aria-[current=page]:text-primary-dark"
            >
              {({ isActive }) => (
                <>
                  {/* The pill behind the icon. Filled on the current tab, so the selection is
                      shown by shape as well as colour (WCAG 1.4.1). */}
                  <span
                    data-slot="tab-pill"
                    data-active={isActive}
                    className={cn(
                      // 56 × 28 px capsule, as in iOS and Material tab bars.
                      'flex h-7 w-14 items-center justify-center rounded-full transition-colors',
                      // Soft brand fill on the current tab only.
                      isActive && 'bg-primary-light',
                    )}
                  >
                    {/* Icon, hidden from screen readers because the label says the same thing. */}
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  {/* The label, with the Preview pill beside it where the destination has one, so
                      every tab keeps the same height. Both are in the link's accessible name.
                      The label is bolder on the current tab, the second non-colour cue. */}
                  <span className="flex items-center gap-1">
                    <span className={cn('font-medium', isActive && 'font-semibold')}>{label}</span>
                    {preview && <PreviewBadge className="px-1 text-[9px] leading-3.5" />}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
