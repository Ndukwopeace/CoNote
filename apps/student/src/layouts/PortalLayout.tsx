/**
 * The signed-in shell around every portal page except Home (D104): the shared navigation (a
 * sidebar on wider screens, the drawer on phones), the top bar and the main content area. Home
 * has its own screen but uses the same navigation, so the app looks the same everywhere.
 */

// Opens and closes the phone drawer.
import { useState } from 'react'
// Outlet renders the current portal page.
import { Outlet } from 'react-router'

// Spinner for the moment before the session is known.
import { FullPageLoader } from '@conote/ui/common/FullPageLoader'
// Sign-in state, for the student's name and email.
import { useAuth } from '@/features/auth/useAuth'
// "You're offline" banner (FR-PWA-4).
import { OfflineBanner } from '@/features/pwa/OfflineBanner'
// The bell's unread count.
import { useUnreadCount } from '@/hooks/useNotifications'
// The count beside "Summaries".
import { useNewSummaryCount } from '@/hooks/useNewSummaryCount'

// The navigation every page shares.
import { AppNav } from './AppNav'
// The phone drawer.
import { NavDrawer } from './NavDrawer'
// Search, notifications and account menu.
import { TopBar } from './TopBar'

/** The signed-in shell: sidebar on wider screens, drawer on phones. */
export function PortalLayout() {
  // Current sign-in state.
  const auth = useAuth()
  // Unread notifications for the bell. Called before the early return, as hooks must be.
  const unread = useUnreadCount()
  // Summaries not opened yet, for the navigation.
  const newSummaries = useNewSummaryCount()
  // Whether the phone drawer is open.
  const [drawerOpen, setDrawerOpen] = useState(false)
  // RequireStudent already guarantees a session; this also keeps TypeScript certain of it.
  if (auth.status !== 'signedIn') return <FullPageLoader />
  // The name and email shown in the account menu.
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
      {/* Wider screens: the navigation is always there, fixed to the left edge. The left offset
          keeps it clear of the notch on a sideways iPhone; zero elsewhere. */}
      <aside className="fixed inset-y-0 left-[env(safe-area-inset-left)] z-30 hidden w-72 border-r bg-card md:block">
        <AppNav newSummaries={newSummaries} />
      </aside>
      {/* Content column, pushed right by the sidebar (288 px). */}
      <div className="md:pl-72">
        {/* Top bar. The bell shows no badge while the count loads or if it fails. */}
        <TopBar
          fullName={fullName}
          email={email}
          unreadCount={unread.data ?? 0}
          onMenu={() => {
            setDrawerOpen(true)
          }}
        />
        {/* Main content. tabIndex={-1} lets the skip link move focus here. */}
        <main id="main" tabIndex={-1} className="px-4 py-6 pb-10 outline-none md:px-8">
          {/* Under the top bar while the connection is down (FR-PWA-4). Inside <main>, so the
              message sits in a landmark; negative margins run it edge to edge. */}
          <div className="-mx-4 -mt-6 mb-6 md:-mx-8">
            <OfflineBanner />
          </div>
          {/* The current page. */}
          <Outlet />
        </main>
      </div>
      {/* Phones: the navigation slides in from the left. */}
      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <AppNav
          newSummaries={newSummaries}
          onDone={() => {
            setDrawerOpen(false)
          }}
        />
      </NavDrawer>
    </div>
  )
}
