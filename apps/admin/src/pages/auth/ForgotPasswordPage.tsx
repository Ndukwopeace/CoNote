/**
 * The console's forgot-password page, at /admin/forgot-password: the shared page
 * (packages/portal) with the console's sign-in address.
 */

// The shared page.
import { ForgotPasswordPage as PortalForgotPasswordPage } from '@conote/portal/pages/forgot-password'

// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

/** "Reset your password": email, then a confirmation. */
export function ForgotPasswordPage() {
  return <PortalForgotPasswordPage loginPath={ADMIN_ROUTES.login} />
}
