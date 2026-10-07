/**
 * The sign-in page at /login (FR-AUTH-1). Email and password with inline validation, "Remember
 * me", the forgotten-password link and the Google button.
 */

// Connects zod schemas to react-hook-form.
import { zodResolver } from '@hookform/resolvers/zod'
// Form state, validation timing and field registration.
import { useForm } from 'react-hook-form'
// Links, and the navigation state that may carry a notice.
import { Link, useLocation } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Labelled field with its inline error.
import { FormField } from '@/components/forms/FormField'
// Error and success boxes above the form.
import { FormMessage } from '@/components/forms/FormMessage'
// Password input with the show/hide toggle.
import { PasswordInput } from '@/components/forms/PasswordInput'
// Standard button.
import { Button } from '@conote/ui/button'
// Standard text input.
import { Input } from '@conote/ui/input'
// The Google button.
import { OAuthButtons } from '@/features/auth/OAuthButtons'
// Sign-in actions.
import { useAuth } from '@/features/auth/useAuth'
// Busy and error handling shared by the auth forms.
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// Reads the one-off notice, e.g. after a password reset.
import { readAuthNotice } from '@/lib/authNotice'
// The sign-in rules and the form's value type.
import { signInSchema, type SignInValues } from '@/lib/authSchemas'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** Empty starting values, so every field is controlled from the first render. */
const EMPTY: SignInValues = { email: '', password: '', remember: false }

/**
 * Sign in. There is no navigation here: RedirectIfSignedIn moves the student on once the
 * session exists, to ?redirect= if it is safe or the dashboard otherwise.
 */
export function LoginPage() {
  // The two sign-in actions this page uses.
  const { signIn, signInWithProvider } = useAuth()
  // Busy flag, server error and the request runner.
  const { error, isPending, run } = useAuthRequest()
  // The notice sent by another page, if any; only known notices come back (see readAuthNotice).
  const notice = readAuthNotice(useLocation().state)
  // The form. Errors appear when a field loses focus and on submit (FR-AUTH-3).
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(signInSchema), mode: 'onTouched', defaultValues: EMPTY })

  return (
    <div>
      {/* Tab title. */}
      <PageTitle title="Sign in" />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold">Welcome back</h1>
      {/* Subheading. */}
      <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to CoNote.</p>

      {/* The notice from the previous page, when there is one. */}
      {notice && (
        <FormMessage tone="success" className="mt-4">
          {notice}
        </FormMessage>
      )}
      {/* The server error, when there is one (FR-AUTH-6). */}
      {error && (
        <FormMessage tone="error" className="mt-4">
          {error}
        </FormMessage>
      )}

      {/* noValidate: the app reports errors itself, the same way on every browser. handleSubmit
          checks the schema first and calls the function only with valid, trimmed values. */}
      <form
        noValidate
        onSubmit={(event) => void handleSubmit((values) => run(() => signIn(values)))(event)}
        className="mt-6 space-y-4"
      >
        {/* Email. */}
        <FormField id="email" label="Email address" error={errors.email?.message}>
          {/* autoComplete lets password managers fill it in. */}
          {(field) => <Input {...field} type="email" autoComplete="email" {...register('email')} />}
        </FormField>
        {/* Password. "current-password" tells password managers this is a sign-in. */}
        <FormField id="password" label="Password" error={errors.password?.message}>
          {(field) => (
            <PasswordInput {...field} autoComplete="current-password" {...register('password')} />
          )}
        </FormField>
        {/* "Remember me" and the forgotten-password link on one row. */}
        <div className="flex items-center justify-between text-sm">
          {/* Wrapping the checkbox in its label makes the text clickable too. */}
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" {...register('remember')} />
            {/* The text in its own element, so the space next to the box is explicit. */}
            <span>Remember me</span>
          </label>
          {/* Forgotten password. */}
          <Link to={ROUTES.forgotPassword} className="font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        {/* Submit; disabled and relabelled while a request is in flight (FR-AUTH-6). */}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {/* Google, with the same busy and error handling as the form. */}
      <OAuthButtons
        disabled={isPending}
        onSelect={(provider) => void run(() => signInWithProvider(provider))}
      />

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
