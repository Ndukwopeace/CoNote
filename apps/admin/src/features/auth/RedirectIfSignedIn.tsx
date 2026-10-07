/**
 * Guard for the sign-in page: a signed-in admin is sent on, a signed-in non-admin sees the notice.
 */

// Routing.
import { Navigate, Outlet, useSearchParams } from 'react-router'

// Picks a safe destination from ?redirect=.
import { safeRedirectTarget } from '@conote/core/isSafeRedirect'
// Spinner.
import { FullPageLoader } from '@conote/ui/common/FullPageLoader'

// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

// The notice for non-admins.
import { NotAdminNotice } from './NotAdminNotice'
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
  // A non-admin who is signed in can't use the console.
  if (auth.session.user.role !== 'admin') return <NotAdminNotice />
  // SECURITY: the destination comes from the address bar, so it is checked (open redirect).
  const target = safeRedirectTarget(
    searchParams.get('redirect'),
    window.location.origin,
    ADMIN_ROUTES.dashboard,
  )
  return <Navigate to={target} replace />
}
