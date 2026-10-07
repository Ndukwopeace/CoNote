/**
 * The reset-password page at /reset-password?code=… (FR-AUTH-5), opened from the reset email
 * (or the demo link). Checks the link first, then asks for the new password twice.
 */

// Connects zod schemas to react-hook-form.
import { zodResolver } from '@hookform/resolvers/zod'
// Spinner icon for the checking state.
import { LoaderCircle } from 'lucide-react'
// Form state, validation timing and field registration.
import { useForm } from 'react-hook-form'
// Links, navigation after success, and the code in the address.
import { Link, useNavigate, useSearchParams } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Labelled field with its inline error.
import { FormField } from '@/components/forms/FormField'
// Error box.
import { FormMessage } from '@/components/forms/FormMessage'
// Password input with the show/hide toggle.
import { PasswordInput } from '@/components/forms/PasswordInput'
// Standard button.
import { Button } from '@conote/ui/button'
// The update action.
import { useAuth } from '@/features/auth/useAuth'
// Busy and error handling shared by the auth forms.
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// Checks the link's code.
import { useResetLinkCheck } from '@/features/auth/useResetLinkCheck'
// The notice shown on the sign-in page afterwards.
import { authNoticeState } from '@/lib/authNotice'
// The reset rules and the form's value type.
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/authSchemas'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** Empty starting values. */
const EMPTY: ResetPasswordValues = { password: '', confirmPassword: '' }

/** Set a new password from a reset link. */
export function ResetPasswordPage() {
  // The code from the link, or null when the address has none.
  const code = useSearchParams()[0].get('code')
  // Whether the code works, plus a retry for failed checks.
  const { state, retry } = useResetLinkCheck(code)

  // Pick the body for the current state.
  switch (state.status) {
    // Still checking: say so, instead of flashing the form or the expired message.
    case 'checking':
      return (
        // <output> has the built-in "status" role, so the check is announced politely.
        <output className="flex items-center gap-2 text-sm text-muted-foreground">
          {/* Tab title while checking. */}
          <PageTitle title="Reset password" />
          {/* Decorative spinner; the text says what's happening. */}
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Checking your reset link…
        </output>
      )
    // The check failed: the link may be fine, so don't call it expired. Offer a retry.
    case 'error':
      return (
        <div>
          {/* Tab title. */}
          <PageTitle title="Reset password" />
          {/* Heading keeps the page's name. */}
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          {/* What went wrong, announced. */}
          <FormMessage tone="error" className="mt-4">
            {state.message}
          </FormMessage>
          {/* Try the check again. */}
          <Button type="button" className="mt-4 w-full" onClick={retry}>
            Try again
          </Button>
        </div>
      )
    // Missing, made up, used or replaced: no fields, just the way to a new link (FR-AUTH-5).
    case 'expired':
      return (
        <div>
          {/* Tab title. */}
          <PageTitle title="Link expired" />
          {/* The state is the heading, so it is the first thing read out. */}
          <h1 className="text-2xl font-bold">This reset link has expired</h1>
          {/* Why, and what to do. */}
          <p className="mt-2 text-sm text-muted-foreground">
            Reset links work once, and only the most recent one works. Ask for a new link to
            continue.
          </p>
          {/* Back to the forgot page. */}
          <Button asChild className="mt-6 w-full">
            <Link to={ROUTES.forgotPassword}>Request a new link</Link>
          </Button>
        </div>
      )
    // The code works: show the form. `valid` is only reached with a code, so "" never occurs.
    // The key gives each code a fresh form, so typed passwords don't carry over between links.
    case 'valid':
      return <NewPasswordForm key={code} code={code ?? ''} />
  }
}

/** The new password form, shown once the link's `code` has been checked. */
function NewPasswordForm({ code }: Readonly<{ code: string }>) {
  // The reset action, the sign-in status and sign-out.
  const { resetPassword, status, signOut } = useAuth()
  // Busy flag, server error and the request runner.
  const { error, isPending, run } = useAuthRequest()
  // Navigation after success.
  const navigate = useNavigate()
  // The form. Errors appear when a field loses focus and on submit (FR-AUTH-3).
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  })

  /** Saves the password and, on success, goes to sign in with a notice. */
  async function save({ password }: { password: string }) {
    // Ask the service, which checks the code again; failures are already shown by the runner.
    const result = await run(() => resetPassword(code, password))
    // Stay here after a failure so the student can try again.
    if (!result.ok) return
    // A session left on this device would make the sign-in page skip to the dashboard and lose
    // the notice. SECURITY: ending it also means whoever used the old password is signed out
    // here. signOut never rejects.
    if (status === 'signedIn') await signOut()
    // SECURITY: replace, so the page with the code in its address leaves the history and
    // the Back button can't reopen it.
    void navigate(ROUTES.login, { replace: true, state: authNoticeState('passwordUpdated') })
  }

  return (
    <div>
      {/* Tab title. */}
      <PageTitle title="Reset password" />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {/* The rules, stated up front so nobody has to guess them. */}
      <p className="mt-1 text-sm text-muted-foreground">
        Use at least 8 characters, with a letter and a number.
      </p>
      {/* The server error, when there is one (FR-AUTH-6). */}
      {error && (
        <FormMessage tone="error" className="mt-4">
          {error}
        </FormMessage>
      )}
      {/* noValidate: the app reports errors itself. */}
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(save)(event)}
        className="mt-6 space-y-4"
      >
        {/* New password; "new-password" lets password managers suggest and save it. */}
        <FormField id="password" label="New password" error={errors.password?.message}>
          {(field) => (
            <PasswordInput {...field} autoComplete="new-password" {...register('password')} />
          )}
        </FormField>
        {/* The same again, to catch typos. */}
        <FormField
          id="confirmPassword"
          label="Confirm new password"
          error={errors.confirmPassword?.message}
        >
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
          )}
        </FormField>
        {/* Submit; disabled and relabelled while in flight (FR-AUTH-6). */}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  )
}
