/**
 * The console's forgot-password page, at /admin/forgot-password. The administrator types an
 * email and always gets the same answer, whether or not an account exists.
 */

// Connects the zod rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// The confirmation state.
import { useState } from 'react'
// Form state.
import { useForm } from 'react-hook-form'
// Links.
import { Link } from 'react-router'

// Button and text input.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
// Labelled field and message box.
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'

// The card around the page.
import { AuthCard } from '@/components/common/AuthCard'
// The reset request, and request state for the form.
import { useAuth } from '@/features/auth/useAuth'
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// The form's rules.
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/authSchemas'
// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'
// The request's result.
import type { PasswordResetRequest } from '@/types/auth'

/** The empty form. */
const EMPTY: ForgotPasswordValues = { email: '' }

/** "Reset your password": email, then a confirmation. */
export function ForgotPasswordPage() {
  // The reset request.
  const { requestPasswordReset } = useAuth()
  // Pending and error state.
  const { error, isPending, run } = useAuthRequest()
  // The request's result once sent; switches the page to the confirmation.
  const [sent, setSent] = useState<PasswordResetRequest | null>(null)
  // Form state with the zod rules.
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
  async function send({ email }: ForgotPasswordValues) {
    const result = await run(() => requestPasswordReset(email))
    if (result.ok) setSent(result.value)
  }

  return (
    <AuthCard title="Reset password">
      {/* Heading. */}
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {sent ? (
        <div className="mt-4 space-y-4">
          {/* SECURITY: the same words whether or not the account exists (account enumeration). */}
          <FormMessage tone="success">
            If an account exists for that email, we sent a link to reset its password.
          </FormMessage>
          {/* Demo only: no email is sent, so the link is offered here. A real service never
              returns one, so this never shows in production. */}
          {sent.demoResetPath && (
            <Button asChild className="w-full">
              <Link to={sent.demoResetPath}>Continue to reset (demo)</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* What happens next. */}
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your administrator email and we&apos;ll send a link to choose a new password.
          </p>
          {/* A failed request's message. */}
          {error && (
            <FormMessage tone="error" className="mt-4">
              {error}
            </FormMessage>
          )}
          {/* noValidate: the zod rules give the messages, not the browser. */}
          <form
            noValidate
            onSubmit={(event) => void handleSubmit(send)(event)}
            className="mt-6 space-y-4"
          >
            {/* Email. */}
            <FormField id="email" label="Email" error={errors.email?.message}>
              {(field) => (
                <Input {...field} type="email" autoComplete="username" {...register('email')} />
              )}
            </FormField>
            {/* Submit. */}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </>
      )}
      {/* The way back. */}
      <p className="mt-6 text-center text-sm">
        <Link to={ADMIN_ROUTES.login} className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
