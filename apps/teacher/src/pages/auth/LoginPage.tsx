/**
 * The portal's sign-in page, at /teacher/login (teacher REQUIREMENTS section 5). There is no sign-up:
 * teacher accounts are invited by an administrator.
 */

// Connects the zod rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// Form state.
import { useForm } from 'react-hook-form'
// Links, and the navigation state that may carry a notice.
import { Link, useLocation } from 'react-router'

// Button and text input.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
// Labelled field, message box and password input with a show toggle.
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'
import { PasswordInput } from '@conote/ui/forms/PasswordInput'

// The card around the page.
import { AuthCard } from '@/components/common/AuthCard'
// Sign-in, and request state for the form.
import { useAuth } from '@/features/auth/useAuth'
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// Notices from other pages ("Your password has been updated").
import { readAuthNotice } from '@/lib/authNotice'
// The form's rules.
import { signInSchema, type SignInValues } from '@/lib/authSchemas'
// Which data source is running, for the demo hint.
import { env } from '@/lib/env'
// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

/** The empty form. */
const EMPTY: SignInValues = { email: '', password: '' }

/** Sign-in's own wording: an account an administrator deactivated or suspended is told so. */
const LOGIN_MESSAGES = { forbidden: 'This account is not active. Contact your administrator.' }

/** "CoNote Teacher": email, password, Sign In. */
export function LoginPage() {
  // Sign-in; on success the page's guard sends the teacher on.
  const { signIn } = useAuth()
  // Pending and error state.
  const { error, isPending, run } = useAuthRequest(LOGIN_MESSAGES)
  // A notice another page asked for. SECURITY: only known keys show (readAuthNotice).
  const notice = readAuthNotice(useLocation().state)
  // Form state with the zod rules; errors show once a field has been left.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(signInSchema), mode: 'onTouched', defaultValues: EMPTY })

  return (
    <AuthCard title="Sign in">
      {/* The spec's heading and subtitle. */}
      <h1 className="text-2xl font-bold">CoNote Teacher</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to review class summaries.</p>
      {/* A notice from another page, such as after a password reset. */}
      {notice && (
        <FormMessage tone="success" className="mt-4">
          {notice}
        </FormMessage>
      )}
      {/* A failed attempt's message. */}
      {error && (
        <FormMessage tone="error" className="mt-4">
          {error}
        </FormMessage>
      )}
      {/* noValidate: the zod rules give the messages, not the browser. */}
      <form
        noValidate
        onSubmit={(event) => void handleSubmit((values) => run(() => signIn(values)))(event)}
        className="mt-6 space-y-4"
      >
        {/* Email. */}
        <FormField id="email" label="Email" error={errors.email?.message}>
          {(field) => (
            <Input {...field} type="email" autoComplete="username" {...register('email')} />
          )}
        </FormField>
        {/* Password, with a show toggle and the way to recover it. */}
        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          labelAside={
            <Link
              to={TEACHER_ROUTES.forgotPassword}
              className="text-sm font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          }
        >
          {(field) => (
            <PasswordInput {...field} autoComplete="current-password" {...register('password')} />
          )}
        </FormField>
        {/* Submit; says what it's doing while busy. */}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
      {/* Demo mode only: the demo teacher account, so reviewers can get in. */}
      {env.dataSource === 'mock' && (
        <p className="mt-6 rounded-md bg-primary-light px-3 py-2 text-xs text-primary-dark">
          Demo: sign in as <code className="font-semibold">teacher@conote.example</code> with the
          password <code className="font-semibold">password1</code>.
        </p>
      )}
    </AuthCard>
  )
}
