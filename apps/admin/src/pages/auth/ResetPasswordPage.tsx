/**
 * The console's reset-password page, at /admin/reset-password?code=…, opened from the reset
 * email. The link is checked first; only a valid one shows the form.
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
import { AuthCard } from '@/components/common/AuthCard'
// The reset, and request state for the form.
import { useAuth } from '@/features/auth/useAuth'
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// The link check.
import { useResetLinkCheck } from '@/hooks/useResetLinkCheck'
// The notice for the sign-in page.
import { authNoticeState } from '@/lib/authNotice'
// The form's rules.
import { ADMIN_MIN_PASSWORD_LENGTH, resetPasswordSchema } from '@/lib/authSchemas'
// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

/** The form's rules, connected once rather than on every render. */
const RESOLVER = zodResolver(resetPasswordSchema)

/** "Choose a new password", or "This link has expired". */
export function ResetPasswordPage() {
  // The code from the link.
  const code = useSearchParams()[0].get('code')
  // Whether the link is still valid.
  const check = useResetLinkCheck(code)

  // Still checking.
  if (check.isPending) return <FullPageLoader />
  // SECURITY: a missing, made-up, replaced or used link never shows the form.
  if (check.isError || !check.data || code === null) return <ExpiredLink />
  // A valid link.
  return <ResetForm code={code} />
}

/** The page for a link that can't be used, with the way to get a new one. */
function ExpiredLink() {
  return (
    <AuthCard title="Link expired">
      <h1 className="text-2xl font-bold">This link has expired</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reset links work once, and only the newest one works. Ask for a new link to continue.
      </p>
      <Button asChild className="mt-6 w-full">
        <Link to={ADMIN_ROUTES.forgotPassword}>Request a new link</Link>
      </Button>
    </AuthCard>
  )
}

/** The new-password form for a valid `code`. */
function ResetForm({ code }: Readonly<{ code: string }>) {
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
      void navigate(ADMIN_ROUTES.login, {
        replace: true,
        state: authNoticeState('passwordUpdated'),
      })
    }
  }

  return (
    <AuthCard title="Choose a new password">
      {/* Heading. */}
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {/* The rules line, both fields and the submit, shared with the student portal. */}
      <NewPasswordForm
        resolver={RESOLVER}
        minLength={ADMIN_MIN_PASSWORD_LENGTH}
        error={error}
        isPending={isPending}
        onSubmit={save}
      />
    </AuthCard>
  )
}
