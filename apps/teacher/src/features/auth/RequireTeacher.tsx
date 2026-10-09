/**
 * Route guard for every portal page (teacher REQUIREMENTS section 3). Signed-out visitors
 * go to sign-in; signed-in students and admins see a notice; teachers get in.
 * SECURITY: this guard is for the user experience only. Real enforcement is the backend's Row
 * Level Security and the teacher-only checks in its server functions (ENGINEERING_STANDARDS.md 6.4).
 */

// Routing.
import { Navigate, Outlet, useLocation } from 'react-router'

// Spinner.
import { FullPageLoader } from '@conote/ui/common/FullPageLoader'

// Path builders.
import { routeTo } from '@/lib/routes'

// The notice for non-teachers.
import { NotTeacherNotice } from './NotTeacherNotice'
// Sign-in state.
import { useAuth } from './useAuth'

/** Shows the portal only to signed-in teachers. */
export function RequireTeacher() {
  // Sign-in state.
  const auth = useAuth()
  // The address asked for, to come back to after sign-in.
  const location = useLocation()

  // Still checking the stored session.
  if (auth.status === 'loading') return <FullPageLoader />
  // Signed out: sign in first, then return here.
  if (auth.status === 'signedOut') {
    return <Navigate to={routeTo.login(location.pathname + location.search)} replace />
  }
  // SECURITY: any role but teacher stops here (privilege escalation through the UI).
  if (auth.session.user.role !== 'teacher') return <NotTeacherNotice />
  // A teacher: show the page.
  return <Outlet />
}
