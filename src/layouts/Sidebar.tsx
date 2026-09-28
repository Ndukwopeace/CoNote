/**
 * Navigation for tablets (icon rail) and desktops (full sidebar with labels).
 */

// Logo link back to the dashboard.
import { NavLink } from 'react-router'

// The CoNote logo.
import { Logo } from '@/components/common/Logo'
// Round avatar showing the student's initials.
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
// Tooltips show labels while the rail hides them.
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
// "Victory Okafor" → "VO".
import { initials } from '@/lib/initials'
// Route constants.
import { ROUTES } from '@/lib/routes'

// The shared list of destinations.
import { NAV_ITEMS } from './navItems'
// A link that works inside TooltipTrigger (see SidebarLink for why).
import { SidebarLink } from './SidebarLink'

/**
 * Desktop (≥ 1024 px): full sidebar with labels.
 * Tablet (768–1023 px): icon rail; labels move into tooltips but stay readable by screen readers.
 * Hidden on phones, where BottomNav takes over.
 */
export function Sidebar({ fullName }: { fullName: string }) {
  return (
    // Fixed to the left edge. Hidden on phones; 64 px wide from 768 px; 240 px from 1024 px.
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r bg-surface md:flex lg:w-60">
      {/* Logo linking to the dashboard. */}
      <NavLink
        to={ROUTES.dashboard}
        className="flex h-16 items-center justify-center rounded-md px-3 lg:justify-start lg:px-5"
      >
        {/* Mark only on the rail (its name stays available to screen readers). */}
        <Logo compact className="lg:hidden" />
        {/* Mark plus wordmark on the full sidebar. */}
        <Logo className="hidden lg:inline-flex" />
      </NavLink>

      {/* Main navigation, named so it differs from the phone bar's "Quick navigation". */}
      <nav aria-label="Main navigation" className="flex-1 px-2 py-4 lg:px-3">
        <ul className="space-y-1">
          {/* One entry per destination. */}
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              {/* Tooltip wrapper: shows the label on hover or focus while the rail hides it. */}
              <Tooltip>
                {/* asChild: the link itself is the trigger, so no extra button wraps it. */}
                <TooltipTrigger asChild>
                  {/* 44 px tall rows; centred icons on the rail, left-aligned with text on desktop. */}
                  <SidebarLink
                    to={to}
                    className="flex h-11 items-center justify-center gap-3 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:justify-start lg:px-3"
                    activeClassName="bg-primary-light text-primary-dark"
                  >
                    {/* Icon, hidden from screen readers because the label follows. */}
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    {/* Visually hidden on the rail, shown on desktop; always read by screen
                        readers, so the link never loses its name. */}
                    <span className="sr-only lg:not-sr-only">{label}</span>
                  </SidebarLink>
                </TooltipTrigger>
                {/* Tooltip text to the right; not needed on desktop, where labels show. */}
                <TooltipContent side="right" className="lg:hidden">
                  {label}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </nav>

      {/* Student card at the bottom. */}
      <div className="flex items-center justify-center gap-3 border-t p-3 lg:justify-start lg:px-5">
        {/* Initials in a circle. */}
        <Avatar>
          <AvatarFallback>{initials(fullName)}</AvatarFallback>
        </Avatar>
        {/* Name and role, desktop only. */}
        <div className="hidden min-w-0 lg:block">
          {/* truncate cuts long names with "…" instead of breaking the layout. */}
          <p className="truncate text-sm font-semibold">{fullName}</p>
          <p className="text-xs text-muted-foreground">Student</p>
        </div>
      </div>
    </aside>
  )
}
