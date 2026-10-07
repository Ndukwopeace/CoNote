/**
 * Route guard for public pages that make no sense once signed in: landing, sign in, sign up.
 */

// Runs the "sign-out has landed" acknowledgement after render.
import { useEffect } from 'react'
// Navigate redirects; Outlet renders the wrapped page; useSearchParams reads ?redirect=.
import { Navigate, Outlet, useSearchParams } from 'react-router'

// Spinner while the session is being checked.
import { FullPageLoader } from '@conote/ui/common/FullPageLoader'
// Picks a safe destination from ?redirect=.
import { safeRedirectTarget } from '@conote/core/isSafeRedirect'
// Route constants: the dashboard is where a signed-in student goes by default.
import { ROUTES } from '@/lib/routes'

// Screen for teachers and admins.
import { NotStudentNotice } from './NotStudentNotice'
// Sign-in state.
import { useAuth } from './useAuth'

/**
 * Wraps public pages that make no sense once signed in (landing, sign in, sign up).
 * A signed-in student goes to the page they originally asked for, if it is safe, or the
 * dashboard. Sign-in forms therefore never navigate themselves. A signed-in teacher or admin
 * sees the students-only notice (REQUIREMENTS.md section 3).
 */
export function RedirectIfSignedIn() {
  // Current sign-in state and actions.
  const auth = useAuth()
  // Query parameters of the current address.
  const [searchParams] = useSearchParams()
  // True just after a chosen sign-out has brought the student here.
  const hasPendingExit = auth.status === 'signedOut' && auth.exitTo !== null
  // Pulled out so the effect below depends on the function only, not the whole auth object.
  const { acknowledgeSignOut } = auth

  // Once this page is showing after sign-out, clear the destination so later visits behave normally.
  useEffect(() => {
    if (hasPendingExit) acknowledgeSignOut()
  }, [hasPendingExit, acknowledgeSignOut])

  // Still checking: show a spinner rather than flashing the wrong page.
  if (auth.status === 'loading') return <FullPageLoader />
  // Someone is signed in.
  if (auth.status === 'signedIn') {
    // SECURITY: teachers and admins get the notice instead of any student-facing page.
    if (auth.session.user.role !== 'student') return <NotStudentNotice />
    // SECURITY: blocks open redirects. The ?redirect= value is followed only if it stays on
    // CoNote; otherwise the student goes to the dashboard. Without this, a crafted sign-in link
    // could forward a student to a fake site straight after they log in.
    const target = safeRedirectTarget(
      searchParams.get('redirect'),
      window.location.origin,
      ROUTES.dashboard,
    )
    // Replace (not push) so Back doesn't return to the sign-in page.
    return <Navigate to={target} replace />
  }
  // Signed out: show the public page.
  return <Outlet />
}
