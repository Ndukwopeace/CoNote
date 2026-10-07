/**
 * Route guard for the landing page (decision D36). The installed app opens at sign-in and the
 * portal; the marketing landing page belongs to the website, so the app skips it.
 */

// Navigate redirects; Outlet renders the landing page.
import { Navigate, Outlet } from 'react-router'

// Route constants.
import { ROUTES } from '@/lib/routes'

// Whether this is the installed app.
import { isRunningStandalone } from './displayMode'

/**
 * In the installed app, sends "/" to sign in (signed-in students never get here, because
 * RedirectIfSignedIn has already sent them to Home). In a browser tab, shows the landing page.
 * This also makes sign-out in the app end on sign in rather than the landing page (D21).
 */
export function SkipLandingInApp() {
  // Replace, so Back doesn't return to "/" and bounce straight back to sign in.
  return isRunningStandalone() ? <Navigate to={ROUTES.login} replace /> : <Outlet />
}
