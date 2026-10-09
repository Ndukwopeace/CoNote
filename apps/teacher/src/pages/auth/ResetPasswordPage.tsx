/**
 * The portal's reset-password page, at /teacher/reset-password?code=…: the shared page
 * (packages/portal) with the portal's addresses.
 */

// The shared page.
import { ResetPasswordPage as PortalResetPasswordPage } from '@conote/portal/pages/reset-password'

// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

/** "Choose a new password", or "This link has expired". */
export function ResetPasswordPage() {
  return (
    <PortalResetPasswordPage
      loginPath={TEACHER_ROUTES.login}
      forgotPasswordPath={TEACHER_ROUTES.forgotPassword}
    />
  )
}
