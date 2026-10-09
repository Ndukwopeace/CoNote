/**
 * The frame around every portal page: sidebar, top bar and the page itself.
 */

// Routing.
import { Outlet } from 'react-router'

// Spinner.
import { FullPageLoader } from '@conote/ui/common/FullPageLoader'

// Sign-in state.
import { useAuth } from '@/features/auth/useAuth'

// Sidebar.
import { TeacherSidebar } from './TeacherSidebar'
// Top bar.
import { TeacherTopBar } from './TeacherTopBar'

/** Sidebar, top bar and the current page. Rendered only for teachers (RequireTeacher). */
export function TeacherLayout() {
  // Sign-in state, for the name in the account menu.
  const auth = useAuth()
  // The guard admits only signed-in teachers; this only satisfies the type.
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
      <TeacherSidebar />
      {/* Content column, pushed right by the rail (64 px) or sidebar (240 px). */}
      <div className="md:pl-16 lg:pl-60">
        {/* Top bar. */}
        <TeacherTopBar fullName={fullName} email={email} />
        {/* The page. tabIndex={-1} lets the skip link move focus here. */}
        <main id="main" tabIndex={-1} className="px-4 py-6 outline-none md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
