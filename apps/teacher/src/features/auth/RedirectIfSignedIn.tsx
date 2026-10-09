/**
 * Guard for the sign-in page: a signed-in teacher is sent on, a signed-in non-teacher sees the notice.
 */

// Routing.
import { Navigate, Outlet, useSearchParams } from 'react-router'

// Picks a safe destination from ?redirect=.
import { safeRedirectTarget } from '@conote/core/isSafeRedirect'
// Spinner.
import { FullPageLoader } from '@conote/ui/common/FullPageLoader'

// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

// The notice for non-teachers.
import { NotTeacherNotice } from './NotTeacherNotice'
// Sign-in state.
import { useAuth } from './useAuth'

/** Shows sign-in only to signed-out visitors. */
export function RedirectIfSignedIn() {
  // Sign-in state.
  const auth = useAuth()
  // The ?redirect= value.
  const [searchParams] = useSearchParams()

  // Still checking the stored session.
  if (auth.status === 'loading') return <FullPageLoader />
  // Signed out: show the sign-in page.
  if (auth.status === 'signedOut') return <Outlet />
  // A non-teacher who is signed in can't use the portal.
  if (auth.session.user.role !== 'teacher') return <NotTeacherNotice />
  // SECURITY: the destination comes from the address bar, so it is checked (open redirect).
  const target = safeRedirectTarget(
    searchParams.get('redirect'),
    window.location.origin,
    TEACHER_ROUTES.courses,
  )
  return <Navigate to={target} replace />
}
