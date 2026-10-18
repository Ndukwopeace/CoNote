/**
 * The navigation every signed-in page shares (D104): the sidebar on wider screens and the drawer
 * on phones, the same on Home and on every other page. A page may put its own section above the
 * links (Home puts its classes there). Below the links: the light/dark switch and sign-out.
 */

// Icons for the theme switch and sign-out.
import { LogOut, Moon, Sun } from 'lucide-react'
// Type for what a page puts in the navigation.
import type { ReactNode } from 'react'
// Client-side links, and the current address (to mark the current page).
import { Link, useLocation } from 'react-router'

// The CoNote logo.
import { Logo } from '@conote/ui/common/Logo'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Sign-in state: signing out.
import { useAuth } from '@/features/auth/useAuth'
// The light/dark choice.
import { useTheme } from '@/features/theme/useTheme'
// Addresses.
import { ROUTES } from '@/lib/routes'

/** The look of one row, link or button. */
export const NAV_ROW =
  'flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[0.9375rem] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** What the navigation needs. */
interface AppNavProps {
  // Summaries the student hasn't opened yet, shown beside "Summaries".
  newSummaries: number
  // Called after any choice, so the phone drawer can close.
  onDone?: () => void
  // A section the page puts above the links.
  children?: ReactNode
}

/** One destination. */
interface Destination {
  label: string
  to: string
  // Whether the address (path and query) is this destination's page.
  isCurrent: (pathname: string, search: string) => boolean
}

/** Whether the notes page is open on its Summaries tab. */
function onSummariesTab(search: string) {
  // The tab is chosen with ?tab=summaries.
  return new URLSearchParams(search).get('tab') === 'summaries'
}

/** Whether `pathname` is `base` or a page under it. */
function isUnder(pathname: string, base: string) {
  // The page itself, or something below it (a course's classes, a settings tab).
  return pathname === base || pathname.startsWith(`${base}/`)
}

/** The destinations, in the order of the approved mockup, with Home first. */
const DESTINATIONS: readonly Destination[] = [
  { label: 'Home', to: ROUTES.dashboard, isCurrent: (path) => path === ROUTES.dashboard },
  {
    label: 'Summaries',
    to: `${ROUTES.notes}?tab=summaries`,
    // The same page as All notes, so only one of the two is marked.
    isCurrent: (path, search) => path === ROUTES.notes && onSummariesTab(search),
  },
  {
    label: 'All notes',
    to: ROUTES.notes,
    isCurrent: (path, search) => path === ROUTES.notes && !onSummariesTab(search),
  },
  { label: 'Courses', to: ROUTES.courses, isCurrent: (path) => isUnder(path, ROUTES.courses) },
  { label: 'Classes', to: ROUTES.classes, isCurrent: (path) => isUnder(path, ROUTES.classes) },
  { label: 'Settings', to: ROUTES.settings, isCurrent: (path) => isUnder(path, ROUTES.settings) },
]

/** The navigation. */
export function AppNav({ newSummaries, onDone, children }: Readonly<AppNavProps>) {
  // Only sign-out is needed from the auth context.
  const { signOut } = useAuth()
  // The theme in use, and the switch.
  const { theme, toggle } = useTheme()
  // Where the student is now.
  const { pathname, search } = useLocation()
  // The switch names the theme it will turn on, not the one in use.
  const other = theme === 'dark' ? 'Light' : 'Dark'
  // The icon is the theme it will turn on, too.
  const SwitchIcon = theme === 'dark' ? Sun : Moon

  return (
    // The links scroll if the screen is short; the theme switch and sign-out stay in view below.
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3.5 pb-2">
        {/* The logo. */}
        <div className="px-1.5 pb-3">
          <Logo />
        </div>
        {/* The page's own section, if it has one. */}
        {children}
        {children && <div className="my-3 h-px bg-border" />}
        {DESTINATIONS.map(({ label, to, isCurrent }) => {
          // Whether this row is the page the student is on.
          const current = isCurrent(pathname, search)
          return (
            <Link
              key={label}
              to={to}
              // Tells screen readers which page this is; the highlight shows it to everyone else.
              aria-current={current ? 'page' : undefined}
              onClick={onDone}
              className={cn(NAV_ROW, current && 'bg-accent font-semibold text-accent-foreground')}
            >
              {label}
              {/* Only Summaries has a count, and only while some are unread. */}
              {label === 'Summaries' && newSummaries > 0 && (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs text-primary-foreground">
                  {newSummaries} new
                </span>
              )}
            </Link>
          )
        })}
      </div>
      <div className="flex flex-col gap-1 border-t p-3.5 pt-2">
        {/* Light or dark, kept on this device. */}
        <button
          type="button"
          onClick={toggle}
          className={cn(NAV_ROW, 'justify-start gap-2 text-muted-foreground')}
        >
          <SwitchIcon aria-hidden="true" className="size-4" />
          {other} mode
        </button>
        {/* No navigation here: the route guard sends the student to the landing page. */}
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(NAV_ROW, 'justify-start gap-2 text-muted-foreground')}
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </button>
      </div>
    </nav>
  )
}
