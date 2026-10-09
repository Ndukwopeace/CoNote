/**
 * A staff portal's reset-password page, opened from the reset email with `?code=…`. The link is
 * checked first; only a valid one shows the form.
 */

// Connects the zod rules to the shared form.
import { zodResolver } from '@hookform/resolvers/zod'
// Links, the address's query and navigation.
import { Link, useNavigate, useSearchParams } from 'react-router'

// Button.
import { Button } from '@conote/ui/button'
// Spinner.
import { FullPageLoader } from '@conote/ui/common/FullPageLoader'
// The shared new-password form.
import { NewPasswordForm } from '@conote/ui/forms/NewPasswordForm'

// The card around the page.
import { AuthCard } from '../components/AuthCard'
// The notice for the sign-in page.
import { authNoticeState } from '../auth/authNotice'
// The form's rules.
import { resetPasswordSchema, STAFF_MIN_PASSWORD_LENGTH } from '../auth/authSchemas'
// The reset, and request state for the form.
import { useAuth } from '../auth/useAuth'
import { useAuthRequest } from '../auth/useAuthRequest'
// The link check.
import { useResetLinkCheck } from '../auth/useResetLinkCheck'

/** What a portal gives its reset page: where the other auth pages are. */
export interface ResetPasswordPageProps {
  loginPath: string
  forgotPasswordPath: string
}

/** The form's rules, connected once rather than on every render. */
const RESOLVER = zodResolver(resetPasswordSchema)

/** "Choose a new password", or "This link has expired". */
export function ResetPasswordPage({
  loginPath,
  forgotPasswordPath,
}: Readonly<ResetPasswordPageProps>) {
  // The code from the link.
  const code = useSearchParams()[0].get('code')
  // Whether the link is still valid.
  const check = useResetLinkCheck(code)

  // Still checking.
  if (check.isPending) return <FullPageLoader />
  // SECURITY: a missing, made-up, replaced or used link never shows the form.
  if (check.isError || !check.data || code === null) {
    return <ExpiredLink forgotPasswordPath={forgotPasswordPath} />
  }
  // A valid link.
  return <ResetForm code={code} loginPath={loginPath} />
}

/** The page for a link that can't be used, with the way to get a new one. */
function ExpiredLink({ forgotPasswordPath }: Readonly<{ forgotPasswordPath: string }>) {
  return (
    <AuthCard title="Link expired">
      <h1 className="text-2xl font-bold">This link has expired</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reset links work once, and only the newest one works. Ask for a new link to continue.
      </p>
      <Button asChild className="mt-6 w-full">
        <Link to={forgotPasswordPath}>Request a new link</Link>
      </Button>
    </AuthCard>
  )
}

/** The new-password form for a valid `code`. */
function ResetForm({ code, loginPath }: Readonly<{ code: string; loginPath: string }>) {
  // The reset.
  const { resetPassword } = useAuth()
  // Pending and error state.
  const { error, isPending, run } = useAuthRequest()
  // To leave for sign-in after success.
  const navigate = useNavigate()

  /** Saves the new password, then shows sign-in with a confirmation. */
  async function save(password: string) {
    // Ask the service, which checks the code again; failures are shown by the runner.
    const result = await run(() => resetPassword(code, password))
    // replace: Back shouldn't return to a spent link.
    if (result.ok) {
      void navigate(loginPath, { replace: true, state: authNoticeState('passwordUpdated') })
    }
  }

  return (
    <AuthCard title="Choose a new password">
      {/* Heading. */}
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {/* The rules line, both fields and the submit, shared with the student portal. */}
      <NewPasswordForm
        resolver={RESOLVER}
        minLength={STAFF_MIN_PASSWORD_LENGTH}
        error={error}
        isPending={isPending}
        onSubmit={save}
      />
    </AuthCard>
  )
}
