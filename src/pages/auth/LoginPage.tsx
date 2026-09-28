/**
 * The sign-in page (FR-AUTH-1). M1 version: working, with light validation; M2 adds the full
 * form library and inline field errors.
 */

// State for the error message and busy flag; the submit event type.
import { useState, type SubmitEvent } from 'react'
// Links to other pages.
import { Link } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@/components/common/PageTitle'
// Standard button.
import { Button } from '@/components/ui/button'
// Text input.
import { Input } from '@/components/ui/input'
// Sign-in actions.
import { useAuth } from '@/features/auth/useAuth'
// Student-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Normalises thrown values.
import { toAppError } from '@/lib/errors'
// Route constants.
import { ROUTES } from '@/lib/routes'
// "google" or "microsoft".
import type { OAuthProvider } from '@/types/auth'

/** Reads a text field from submitted form data; anything that isn't text becomes "". */
function textField(form: FormData, name: string) {
  // Raw value: a string, a File, or null.
  const value = form.get(name)
  // Only accept text.
  return typeof value === 'string' ? value : ''
}

/**
 * Working sign-in for M1. M2 replaces the form handling with react-hook-form + zod.
 * No navigation here: RedirectIfSignedIn moves the student on once the session exists.
 */
export function LoginPage() {
  // The two sign-in actions this page uses.
  const { signIn, signInWithProvider } = useAuth()
  // The error to show above the form, or null.
  const [error, setError] = useState<string | null>(null)
  // True while a sign-in request is in flight.
  const [isPending, setIsPending] = useState(false)

  /** Runs a sign-in attempt with shared error and busy handling. */
  async function run(action: () => Promise<unknown>) {
    // Clear any old error.
    setError(null)
    // Disable the buttons so the form can't be submitted twice.
    setIsPending(true)
    try {
      // Attempt the sign-in. On success the guard navigates away, so nothing else happens here.
      await action()
    } catch (caught) {
      // SECURITY: show only the safe, student-facing wording. Sign-in never says whether the
      // email or the password was wrong, so the form can't be used to discover accounts.
      setError(errorMessage(toAppError(caught)))
      // Re-enable the form so the student can try again.
      setIsPending(false)
    }
  }

  /** Handles the email and password form. */
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    // Stop the browser's full-page form submission; the app handles it.
    event.preventDefault()
    // Read every field of the submitted form.
    const form = new FormData(event.currentTarget)
    // Try to sign in with the typed values.
    void run(() =>
      signIn({
        email: textField(form, 'email'),
        password: textField(form, 'password'),
        // Checked checkboxes submit "on".
        remember: form.get('remember') === 'on',
      }),
    )
  }

  /** Handles the Google and Microsoft buttons. */
  function handleProvider(provider: OAuthProvider) {
    // Same error and busy handling as the form.
    void run(() => signInWithProvider(provider))
  }

  return (
    <div>
      {/* Tab title. */}
      <PageTitle title="Sign in" />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold">Welcome back</h1>
      {/* Subheading. */}
      <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to CoNote.</p>

      {/* The error, when there is one. role="alert" makes screen readers announce it. */}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong"
        >
          {error}
        </p>
      )}

      {/* noValidate: the app reports errors itself, in the same style everywhere. */}
      <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* Email field. */}
        <div className="space-y-1.5">
          {/* htmlFor ties the label to the input, for screen readers and bigger click targets. */}
          <label htmlFor="email" className="text-sm font-medium">
            Email address
          </label>
          {/* autoComplete lets password managers fill it in. */}
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        {/* Password field. */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          {/* type="password" hides the characters; "current-password" tells password managers
              this is a sign-in, not a new password. */}
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {/* "Remember me" and the forgotten-password link on one row. */}
        <div className="flex items-center justify-between text-sm">
          {/* Wrapping the checkbox in its label makes the text clickable too. */}
          <label className="flex items-center gap-2">
            <input type="checkbox" name="remember" className="size-4 accent-primary" />
            Remember me
          </label>
          {/* Forgotten password. */}
          <Link to={ROUTES.forgotPassword} className="font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        {/* Submit; disabled while a request is in flight to prevent double submission. */}
        <Button type="submit" className="w-full" disabled={isPending}>
          Sign in
        </Button>
      </form>

      {/* Divider text. */}
      <p className="my-6 text-center text-xs text-muted-foreground">or continue with</p>
      {/* Provider buttons: stacked on phones, side by side from 640 px. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* The visible text is just "Google"; aria-label gives screen readers the full action. */}
        <Button
          variant="outline"
          aria-label="Continue with Google"
          disabled={isPending}
          onClick={() => {
            handleProvider('google')
          }}
        >
          Google
        </Button>
        {/* Same for Microsoft. */}
        <Button
          variant="outline"
          aria-label="Continue with Microsoft"
          disabled={isPending}
          onClick={() => {
            handleProvider('microsoft')
          }}
        >
          Microsoft
        </Button>
      </div>

      {/* Link to sign-up for new students. */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link to={ROUTES.signup} className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
