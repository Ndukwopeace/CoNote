/**
 * The portal's forgot-password page, at /teacher/forgot-password: the shared page
 * (packages/portal) with the portal's sign-in address.
 */

// The shared page.
import { ForgotPasswordPage as PortalForgotPasswordPage } from '@conote/portal/pages/forgot-password'

// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

/** "Reset your password": email, then a confirmation. */
export function ForgotPasswordPage() {
  return <PortalForgotPasswordPage loginPath={TEACHER_ROUTES.login} />
}
