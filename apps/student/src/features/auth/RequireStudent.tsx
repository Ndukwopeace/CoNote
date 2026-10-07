/**
 * Route guard for every portal page: only signed-in students get through.
 */

// Navigate redirects; Outlet renders the wrapped pages; useLocation reads the current address.
import { Navigate, Outlet, useLocation } from 'react-router'

// Spinner while the session is being checked.
import { FullPageLoader } from '@/components/common/FullPageLoader'
// Builds the sign-in path with a redirect back.
import { routeTo } from '@/lib/routes'

// Screen for teachers and admins.
import { NotStudentNotice } from './NotStudentNotice'
// Sign-in state.
import { useAuth } from './useAuth'

/**
 * Lets only signed-in students through. This is for user experience only; the database's
 * Row Level Security is the real access control (ENGINEERING_STANDARDS.md 6.4).
 */
export function RequireStudent() {
  // Current sign-in state.
  const auth = useAuth()
  // The address being visited, so sign-in can return here.
  const location = useLocation()

  // Still checking: spinner, so no portal content flashes before the check finishes.
  if (auth.status === 'loading') return <FullPageLoader />
  // Not signed in.
  if (auth.status === 'signedOut') {
    // After a chosen sign-out go to the landing page; otherwise go to sign in and come back here.
    const target = auth.exitTo ?? routeTo.login(location.pathname + location.search)
    // SECURITY: nothing inside the portal renders for a signed-out visitor.
    return <Navigate to={target} replace />
  }
  // SECURITY: signed in but not a student: show the notice, never the portal.
  if (auth.session.user.role !== 'student') return <NotStudentNotice />
  // A signed-in student: show the requested page.
  return <Outlet />
}
