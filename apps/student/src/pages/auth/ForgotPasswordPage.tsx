/**
 * The forgot-password page at /forgot-password (FR-AUTH-4). The student types an email and
 * always gets the same answer, whether or not an account exists.
 */

// Connects the zod rules to the shared form.
import { zodResolver } from '@hookform/resolvers/zod'
// Local state for the confirmation.
import { useState } from 'react'
// The link back to sign in.
import { Link } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// The shared reset-link form.
import { ResetRequestForm } from '@conote/ui/forms/ResetRequestForm'
// The reset action.
import { useAuth } from '@/features/auth/useAuth'
// Busy and error handling shared by the auth forms.
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// The forgot-password rules.
import { forgotPasswordSchema } from '@/lib/authSchemas'
// Route constants.
import { ROUTES } from '@/lib/routes'
// What a reset request returns.
import type { PasswordResetRequest } from '@/types/auth'

/** The form's rules, connected once rather than on every render. */
const RESOLVER = zodResolver(forgotPasswordSchema)

/** Ask for a password reset link. */
export function ForgotPasswordPage() {
  // The reset action.
  const { requestPasswordReset } = useAuth()
  // Busy flag, server error and the request runner.
  const { error, isPending, run } = useAuthRequest()
  // The service's answer once sent, or null before. Its presence switches to the confirmation.
  const [sent, setSent] = useState<PasswordResetRequest | null>(null)
  /** Sends the request and, if it went through, shows the confirmation. */
  async function send(email: string) {
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

      {/* The email form, then the confirmation; shared with the admin console.
          SECURITY: one confirmation for every email, so the page can't be used to find out
          who has an account (account enumeration). */}
      <ResetRequestForm
        resolver={RESOLVER}
        intro="Enter the email you signed up with and we'll send you a link to choose a new password."
        emailLabel="Email address"
        emailAutoComplete="email"
        confirmation="If an account exists for that email, we sent a reset link."
        sent={sent}
        error={error}
        isPending={isPending}
        onSubmit={send}
      />

      {/* Way back, in both states. */}
      <p className="mt-6 text-center text-sm">
        <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
