/**
 * The frame around every page of a staff portal: sidebar (an icon rail with tooltips on tablets,
 * full labels on desktops), top bar with the phone menu and account menu, and the page itself.
 */

// Routing.
import { Link, Outlet } from 'react-router'

// The CoNote logo.
import { Logo } from '@conote/ui/common/Logo'
// Spinner.
import { FullPageLoader } from '@conote/ui/common/FullPageLoader'
// A link that marks the current section without NavLink's function className (CLAUDE.md).
import { SidebarLink } from '@conote/ui/common/SidebarLink'
// Tooltips for the icon rail.
import { Tooltip, TooltipContent, TooltipTrigger } from '@conote/ui/tooltip'

// Sign-in state, for the name in the account menu.
import { useAuth } from '../auth/useAuth'
// Phone navigation and the account menu.
import { MobileNav } from './MobileNav'
import { UserMenu } from './UserMenu'
// What the portal gives the frame.
import type { PortalConfig } from './navItems'

/** The fixed sidebar for tablet and desktop widths. */
function Sidebar({ name, homePath, items }: Readonly<PortalConfig>) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r bg-surface md:flex lg:w-60">
      {/* Logo linking home, with the portal's label on desktop. */}
      <Link
        to={homePath}
        className="flex h-16 items-center justify-center gap-2 rounded-md px-3 lg:justify-start lg:px-5"
      >
        {/* Mark only on the rail (its name stays available to screen readers). */}
        <Logo compact className="lg:hidden" />
        {/* Mark plus wordmark on the full sidebar. */}
        <Logo className="hidden lg:inline-flex" />
        {/* Says which CoNote this is; the rail is too narrow for it. */}
        <span className="hidden rounded bg-primary-light px-1.5 py-0.5 text-xs font-semibold text-primary-dark lg:inline">
          {name}
        </span>
      </Link>
      {/* The sections. */}
      <nav aria-label={`${name} navigation`} className="flex-1 overflow-y-auto px-2 py-4 lg:px-3">
        <ul className="space-y-1">
          {items.map(({ label, to, icon: Icon }) => (
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

/** The bar across the top: the phone menu and logo on the left, the account menu on the right. */
function TopBar({
  config,
  fullName,
  email,
}: Readonly<{ config: PortalConfig; fullName: string; email: string }>) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-surface/95 px-4 backdrop-blur md:px-8">
      {/* Menu button, phones only. */}
      <MobileNav items={config.items} />
      {/* Logo on phones only, where there is no sidebar. Its hidden wordmark names the link. */}
      <Link to={config.homePath} className="shrink-0 rounded-md md:hidden">
        <Logo compact />
      </Link>
      {/* Account menu, pushed to the right. */}
      <div className="ml-auto flex items-center gap-2">
        <UserMenu fullName={fullName} email={email} settingsPath={config.settingsPath} />
      </div>
    </header>
  )
}

/** Sidebar, top bar and the current page. Rendered only for signed-in users (a guard above it). */
export function PortalFrame(config: Readonly<PortalConfig>) {
  // Sign-in state, for the name in the account menu.
  const auth = useAuth()
  // The guard admits only signed-in users; this only satisfies the type.
  if (auth.status !== 'signedIn') return <FullPageLoader />
  // Who is signed in.
  const { fullName, email } = auth.session.user

  return (
    <div className="min-h-dvh">
      {/* Skip link: hidden until focused, lets keyboard users jump past the navigation. */}
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      {/* Sidebar (desktop) or icon rail (tablet). */}
      <Sidebar {...config} />
      {/* Content column, pushed right by the rail (64 px) or sidebar (240 px). */}
      <div className="md:pl-16 lg:pl-60">
        {/* Top bar. */}
        <TopBar config={config} fullName={fullName} email={email} />
        {/* The page. tabIndex={-1} lets the skip link move focus here. */}
        <main id="main" tabIndex={-1} className="px-4 py-6 outline-none md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
