/**
 * The forgot-password page at /forgot-password (FR-AUTH-4). The student types an email and
 * always gets the same answer, whether or not an account exists.
 */

// Connects zod schemas to react-hook-form.
import { zodResolver } from '@hookform/resolvers/zod'
// Local state for the confirmation.
import { useState } from 'react'
// Form state, validation timing and field registration.
import { useForm } from 'react-hook-form'
// Links back to sign in and to the demo reset page.
import { Link } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@/components/common/PageTitle'
// Labelled field with its inline error.
import { FormField } from '@/components/forms/FormField'
// Error and success boxes.
import { FormMessage } from '@/components/forms/FormMessage'
// Standard button.
import { Button } from '@conote/ui/button'
// Standard text input.
import { Input } from '@conote/ui/input'
// The reset action.
import { useAuth } from '@/features/auth/useAuth'
// Busy and error handling shared by the auth forms.
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// The forgot-password rules and the form's value type.
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/authSchemas'
// Route constants.
import { ROUTES } from '@/lib/routes'
// What a reset request returns.
import type { PasswordResetRequest } from '@/types/auth'

/** Empty starting value. */
const EMPTY: ForgotPasswordValues = { email: '' }

/** Ask for a password reset link. */
export function ForgotPasswordPage() {
  // The reset action.
  const { requestPasswordReset } = useAuth()
  // Busy flag, server error and the request runner.
  const { error, isPending, run } = useAuthRequest()
  // The service's answer once sent, or null before. Its presence switches to the confirmation.
  const [sent, setSent] = useState<PasswordResetRequest | null>(null)
  // The form. Errors appear when the field loses focus and on submit.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  })

  /** Sends the request and, if it went through, shows the confirmation. */
  async function send({ email }: { email: string }) {
    // Ask the service; failures are already shown by the runner.
    const result = await run(() => requestPasswordReset(email))
    // Switch to the confirmation only after a real success.
    if (result.ok) setSent(result.value)
  }

  return (
    <div>
      {/* Tab title. */}
      <PageTitle title="Reset password" />
      {/* Page heading, the same in both states so the page keeps its name. */}
      <h1 className="text-2xl font-bold">Reset your password</h1>

      {sent ? (
        // Confirmation state.
        <div className="mt-4 space-y-4">
          {/* SECURITY: the same wording whatever the email, so the page can't be used to find
              out who has an account (account enumeration). */}
          <FormMessage tone="success">
            If an account exists for that email, we sent a reset link.
          </FormMessage>
          {/* Demo mode only (FR-AUTH-7): the service returns the link because it sends no email.
              A real service never returns one, so this never shows in production. */}
          {sent.demoResetPath && (
            <Button asChild className="w-full">
              <Link to={sent.demoResetPath}>Continue to reset (demo)</Link>
            </Button>
          )}
        </div>
      ) : (
        // Form state.
        <>
          {/* What to do. */}
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the email you signed up with and we&apos;ll send you a link to choose a new
            password.
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
            onSubmit={(event) => void handleSubmit(send)(event)}
            className="mt-6 space-y-4"
          >
            {/* Email. */}
            <FormField id="email" label="Email address" error={errors.email?.message}>
              {(field) => (
                <Input {...field} type="email" autoComplete="email" {...register('email')} />
              )}
            </FormField>
            {/* Submit; disabled and relabelled while in flight (FR-AUTH-6). */}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </>
      )}

      {/* Way back, in both states. */}
      <p className="mt-6 text-center text-sm">
        <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
