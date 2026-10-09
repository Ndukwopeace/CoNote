/**
 * The console's reset-password page, at /admin/reset-password?code=…: the shared page
 * (packages/portal) with the console's addresses.
 */

// The shared page.
import { ResetPasswordPage as PortalResetPasswordPage } from '@conote/portal/pages/reset-password'

// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

/** "Choose a new password", or "This link has expired". */
export function ResetPasswordPage() {
  return (
    <PortalResetPasswordPage
      loginPath={ADMIN_ROUTES.login}
      forgotPasswordPath={ADMIN_ROUTES.forgotPassword}
    />
  )
}
