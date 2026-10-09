/**
 * The portal's sign-in page, at /teacher/login (teacher REQUIREMENTS section 5): the shared page
 * (packages/portal) with the portal's words. There is no sign-up: teacher accounts are invited by
 * an administrator.
 */

// The shared page.
import { LoginPage as PortalLoginPage } from '@conote/portal/pages/login'

// Which data source is running, for the demo hint.
import { env } from '@/lib/env'
// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

/** The demo account shown in demo mode. */
const DEMO = { email: 'teacher@conote.example', password: 'password1' }

/** "CoNote Teacher": email, password, Sign In. */
export function LoginPage() {
  return (
    <PortalLoginPage
      title="CoNote Teacher"
      subtitle="Sign in to review class summaries."
      forgotPasswordPath={TEACHER_ROUTES.forgotPassword}
      demo={env.dataSource === 'mock' ? DEMO : undefined}
    />
  )
}
