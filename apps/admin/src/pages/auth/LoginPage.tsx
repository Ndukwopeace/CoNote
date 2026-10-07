/**
 * The console's sign-in page, at /admin/login (admin brief, "Admin login"). There is no sign-up:
 * administrator accounts are provisioned (D66).
 */

// Connects the zod rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// Pending and error state.
import { useState } from 'react'
// Form state.
import { useForm } from 'react-hook-form'

// Normalises anything thrown into an AppError.
import { toAppError } from '@conote/core/errors'
// Error reporting.
import { reportError } from '@conote/core/reportError'
// Button and text input.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
// Logo and tab title.
import { Logo } from '@conote/ui/common/Logo'
import { PageTitle } from '@conote/ui/common/PageTitle'
// Labelled field, message box and password input with a show toggle.
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'
import { PasswordInput } from '@conote/ui/forms/PasswordInput'

// Sign-in.
import { useAuth } from '@/features/auth/useAuth'
// The form's rules.
import { signInSchema, type SignInValues } from '@/lib/authSchemas'
// Which data source is running, for the demo hint.
import { env } from '@/lib/env'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'

/** The empty form. */
const EMPTY: SignInValues = { email: '', password: '' }

/** "CoNote Admin": email, password, Sign In. */
export function LoginPage() {
  // Sign-in; on success the page's guard sends the admin on.
  const { signIn } = useAuth()
  // True while the request runs, so the button can't be pressed twice.
  const [isPending, setIsPending] = useState(false)
  // The message from a failed attempt.
  const [error, setError] = useState<string | null>(null)
  // Form state with the zod rules; errors show once a field has been left.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(signInSchema), mode: 'onTouched', defaultValues: EMPTY })

  /** Signs in with checked values, showing a safe message if it fails. */
  async function submit(values: SignInValues) {
    setIsPending(true)
    setError(null)
    try {
      await signIn(values)
    } catch (error_) {
      // SECURITY: only the safe wording reaches the screen; details go to the reporter.
      const appError = toAppError(error_)
      reportError(error_, { where: 'LoginPage' })
      setError(errorMessage(appError))
      setIsPending(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      {/* Tab title. */}
      <PageTitle title="Sign in" />
      {/* The card. */}
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        {/* Brand. */}
        <Logo />
        {/* The brief's heading and subtitle. */}
        <h1 className="mt-6 text-2xl font-bold">CoNote Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage the CoNote platform.</p>
        {/* A failed attempt's message. */}
        {error && (
          <FormMessage tone="error" className="mt-4">
            {error}
          </FormMessage>
        )}
        {/* noValidate: the zod rules give the messages, not the browser. */}
        <form
          noValidate
          onSubmit={(event) => void handleSubmit(submit)(event)}
          className="mt-6 space-y-4"
        >
          {/* Email. */}
          <FormField id="email" label="Email" error={errors.email?.message}>
            {(field) => (
              <Input {...field} type="email" autoComplete="username" {...register('email')} />
            )}
          </FormField>
          {/* Password, with a show toggle. */}
          <FormField id="password" label="Password" error={errors.password?.message}>
            {(field) => (
              <PasswordInput {...field} autoComplete="current-password" {...register('password')} />
            )}
          </FormField>
          {/* Submit; says what it's doing while busy. */}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
        {/* Demo mode only: the demo admin account, so reviewers can get in. */}
        {env.dataSource === 'mock' && (
          <p className="mt-6 rounded-md bg-primary-light px-3 py-2 text-xs text-primary-dark">
            Demo: sign in as <code className="font-semibold">admin@conote.example</code> with the
            password <code className="font-semibold">password1</code>.
          </p>
        )}
      </div>
    </main>
  )
}
