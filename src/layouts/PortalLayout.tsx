/**
 * The signed-in shell around every portal page: sidebar or bottom bar, top bar, and the main
 * content area.
 */

// Outlet renders the current portal page.
import { Outlet } from 'react-router'

// Spinner for the moment before the session is known.
import { FullPageLoader } from '@/components/common/FullPageLoader'
// Sign-in state, for the student's name and email.
import { useAuth } from '@/features/auth/useAuth'
// "You're offline" banner (FR-PWA-4).
import { OfflineBanner } from '@/features/pwa/OfflineBanner'
// The bell's unread count.
import { useUnreadCount } from '@/hooks/useNotifications'

// Phone navigation.
import { BottomNav } from './BottomNav'
// Tablet and desktop navigation.
import { Sidebar } from './Sidebar'
// Search, notifications and account menu.
import { TopBar } from './TopBar'

/** The signed-in shell: sidebar, rail or bottom bar by screen size (REQUIREMENTS.md section 8). */
export function PortalLayout() {
  // Current sign-in state.
  const auth = useAuth()
  // Unread notifications for the bell. Called before the early return, as hooks must be.
  const unread = useUnreadCount()
  // RequireStudent already guarantees a session; this also keeps TypeScript certain of it.
  if (auth.status !== 'signedIn') return <FullPageLoader />
  // The name and email shown in the navigation.
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
      <Sidebar fullName={fullName} />
      {/* Content column, pushed right by the rail (64 px) or sidebar (240 px). */}
      <div className="md:pl-16 lg:pl-60">
        {/* Top bar. The bell shows no badge while the count loads or if it fails. */}
        <TopBar fullName={fullName} email={email} unreadCount={unread.data ?? 0} />
        {/* Main content. tabIndex={-1} lets the skip link move focus here. Extra bottom
            padding on phones keeps content clear of the bottom bar. */}
        <main id="main" tabIndex={-1} className="px-4 py-6 pb-24 outline-none md:px-8 md:pb-10">
          {/* Under the top bar while the connection is down (FR-PWA-4). Inside <main>, so the
              message sits in a landmark; negative margins run it edge to edge. */}
          <div className="-mx-4 -mt-6 mb-6 md:-mx-8">
            <OfflineBanner />
          </div>
          {/* The current page. */}
          <Outlet />
        </main>
      </div>
      {/* Phone navigation. */}
      <BottomNav />
    </div>
  )
}
