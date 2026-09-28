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
        {/* Top bar. */}
        <TopBar fullName={fullName} email={email} />
        {/* Main content. tabIndex={-1} lets the skip link move focus here. Extra bottom
            padding on phones keeps content clear of the bottom bar. */}
        <main id="main" tabIndex={-1} className="px-4 py-6 pb-24 outline-none md:px-8 md:pb-10">
          {/* The current page. */}
          <Outlet />
        </main>
      </div>
      {/* Phone navigation. */}
      <BottomNav />
    </div>
  )
}
