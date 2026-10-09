/**
 * The console's sign-in page, at /admin/login (admin brief, "Admin login"): the shared page
 * (packages/portal) with the console's words. There is no sign-up: administrator accounts are
 * provisioned (D66).
 */

// The shared page.
import { LoginPage as PortalLoginPage } from '@conote/portal/pages/login'

// Which data source is running, for the demo hint.
import { env } from '@/lib/env'
// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

/** The demo account shown in demo mode. */
const DEMO = { email: 'admin@conote.example', password: 'password1' }

/** "CoNote Admin": email, password, Sign In. */
export function LoginPage() {
  return (
    <PortalLoginPage
      title="CoNote Admin"
      subtitle="Sign in to manage the CoNote platform."
      forgotPasswordPath={ADMIN_ROUTES.forgotPassword}
      demo={env.dataSource === 'mock' ? DEMO : undefined}
    />
  )
}
