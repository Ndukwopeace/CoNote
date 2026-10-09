/**
 * The portal's sidebar: an icon rail with tooltips on tablets, the full sidebar with labels on
 * desktops, hidden on phones (the top bar's menu button opens the same list there).
 */

// Routing.
import { Link } from 'react-router'

// The CoNote logo.
import { Logo } from '@conote/ui/common/Logo'
// A link that marks the current section without NavLink's function className (CLAUDE.md).
import { SidebarLink } from '@conote/ui/common/SidebarLink'
// Tooltips for the icon rail.
import { Tooltip, TooltipContent, TooltipTrigger } from '@conote/ui/tooltip'

// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

// The sections.
import { NAV_ITEMS } from './navItems'

/** The fixed sidebar for tablet and desktop widths. */
export function TeacherSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r bg-surface md:flex lg:w-60">
      {/* Logo linking to My courses, with the "Teacher" label on desktop. */}
      <Link
        to={TEACHER_ROUTES.courses}
        className="flex h-16 items-center justify-center gap-2 rounded-md px-3 lg:justify-start lg:px-5"
      >
        {/* Mark only on the rail (its name stays available to screen readers). */}
        <Logo compact className="lg:hidden" />
        {/* Mark plus wordmark on the full sidebar. */}
        <Logo className="hidden lg:inline-flex" />
        {/* Says which CoNote this is; the rail is too narrow for it. */}
        <span className="hidden rounded bg-primary-light px-1.5 py-0.5 text-xs font-semibold text-primary-dark lg:inline">
          Teacher
        </span>
      </Link>
      {/* The sections. */}
      <nav aria-label="Teacher navigation" className="flex-1 overflow-y-auto px-2 py-4 lg:px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              {/* Tooltip: names the section on hover or focus while the rail hides labels. */}
              <Tooltip>
                {/* asChild: the link itself is the trigger, so no extra button wraps it. */}
                <TooltipTrigger asChild>
                  {/* 44 px rows; centred icons on the rail, icon and label on desktop. */}
                  <SidebarLink
                    to={to}
                    className="flex h-11 items-center justify-center gap-3 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:justify-start lg:px-3"
                    activeClassName="bg-primary-light text-primary-dark"
                  >
                    {/* Icon, hidden from screen readers because the label follows. */}
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    {/* Hidden on the rail, shown on desktop; always read aloud. */}
                    <span className="sr-only lg:not-sr-only">{label}</span>
                  </SidebarLink>
                </TooltipTrigger>
                {/* Not needed on desktop, where labels show. */}
                <TooltipContent side="right" className="lg:hidden">
                  {label}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
