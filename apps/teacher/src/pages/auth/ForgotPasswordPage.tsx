/**
 * The portal's forgot-password page, at /teacher/forgot-password. The teacher types an
 * email and always gets the same answer, whether or not an account exists.
 */

// Connects the zod rules to the shared form.
import { zodResolver } from '@hookform/resolvers/zod'
// The confirmation state.
import { useState } from 'react'
// Links.
import { Link } from 'react-router'

// The shared reset-link form.
import { ResetRequestForm } from '@conote/ui/forms/ResetRequestForm'

// The card around the page.
import { AuthCard } from '@/components/common/AuthCard'
// The reset request, and request state for the form.
import { useAuth } from '@/features/auth/useAuth'
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// The form's rules.
import { forgotPasswordSchema } from '@/lib/authSchemas'
// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'
// The request's result.
import type { PasswordResetRequest } from '@/types/auth'

/** The form's rules, connected once rather than on every render. */
const RESOLVER = zodResolver(forgotPasswordSchema)

/** "Reset your password": email, then a confirmation. */
export function ForgotPasswordPage() {
  // The reset request.
  const { requestPasswordReset } = useAuth()
  // Pending and error state.
  const { error, isPending, run } = useAuthRequest()
  // The request's result once sent; switches the page to the confirmation.
  const [sent, setSent] = useState<PasswordResetRequest | null>(null)

  /** Sends the request and, if it went through, shows the confirmation. */
  async function send(email: string) {
    // Ask the service; failures are shown by the runner.
    const result = await run(() => requestPasswordReset(email))
    // Switch to the confirmation only after a real success.
    if (result.ok) setSent(result.value)
  }

  return (
    <AuthCard title="Reset password">
      {/* Heading. */}
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {/* The email form, then the confirmation; shared with the student portal. The email is
          the teacher's sign-in name, hence "username" for password managers.
          SECURITY: one confirmation for every email, so the page can't reveal who has an
          account (account enumeration). */}
      <ResetRequestForm
        resolver={RESOLVER}
        intro="Enter your email address and we'll send a link to choose a new password."
        emailLabel="Email"
        emailAutoComplete="username"
        confirmation="If an account exists for that email, we sent a link to reset its password."
        sent={sent}
        error={error}
        isPending={isPending}
        onSubmit={send}
      />
      {/* The way back. */}
      <p className="mt-6 text-center text-sm">
        <Link to={TEACHER_ROUTES.login} className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
