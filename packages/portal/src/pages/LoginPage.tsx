/**
 * A staff portal's sign-in page (admin brief "Admin login", teacher REQUIREMENTS section 5). There
 * is no sign-up: staff accounts are provisioned.
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
import { AuthCard } from '../components/AuthCard'
// Notices from other pages ("Your password has been updated").
import { readAuthNotice } from '../auth/authNotice'
// The form's rules.
import { signInSchema, type SignInValues } from '../auth/authSchemas'
// Sign-in, and request state for the form.
import { useAuth } from '../auth/useAuth'
import { useAuthRequest } from '../auth/useAuthRequest'

/** What a portal gives its sign-in page. */
export interface LoginPageProps {
  // The page's heading, e.g. "CoNote Admin".
  title: string
  // The line under it.
  subtitle: string
  // Where "Forgot password?" goes.
  forgotPasswordPath: string
  // Demo mode only: the demo account to show, so reviewers can get in.
  demo?: { email: string; password: string } | undefined
}

/** The empty form. */
const EMPTY: SignInValues = { email: '', password: '' }

/** Sign-in's own wording: an account an administrator deactivated or suspended is told so. */
const LOGIN_MESSAGES = { forbidden: 'This account is not active. Contact your administrator.' }

/** The heading, email, password and Sign In. */
export function LoginPage({ title, subtitle, forgotPasswordPath, demo }: Readonly<LoginPageProps>) {
  // Sign-in; on success the page's guard sends the user on.
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
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
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
              to={forgotPasswordPath}
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
      {/* Demo mode only: the demo account, so reviewers can get in. */}
      {demo && (
        <p className="mt-6 rounded-md bg-primary-light px-3 py-2 text-xs text-primary-dark">
          Demo: sign in as <code className="font-semibold">{demo.email}</code> with the password{' '}
          <code className="font-semibold">{demo.password}</code>.
        </p>
      )}
    </AuthCard>
  )
}
