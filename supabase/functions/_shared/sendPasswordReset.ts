/**
 * send-password-reset: an administrator sends someone a password link (admin REQUIREMENTS section
 * 11). The email is the one the person would get from "Forgot password", pointing at their own
 * app. Only accounts that can sign in get one.
 */

// Checks the body.
import { z } from 'zod'

// The shared steps and answers.
import { adminHandler, type FunctionDeps } from './admin.ts'
import { resetAddress } from './env.ts'
import { json, refuse } from './http.ts'
import { canSendPasswordReset, type AccountStatus } from './rules.ts'

/** The body. */
const bodySchema = z.object({ userId: z.uuid('Choose a person.') })

/** Builds the handler. */
export function sendPasswordResetHandler(deps: FunctionDeps) {
  return adminHandler(deps, bodySchema, async ({ actorId, body }) => {
    const { service, anon } = deps.clients
    // The account the link is for.
    const found = await service
      .from('profiles')
      .select('email, role, status')
      .eq('id', body.userId)
      .maybeSingle()
    if (found.error) return refuse('unknown', 'Something went wrong. Try again.')
    if (!found.data) return refuse('not_found', 'User not found.')
    // Only active accounts can sign in, so only they get a link.
    if (!canSendPasswordReset(found.data.status as AccountStatus)) {
      return refuse('validation', 'Only active accounts can be sent a reset link.')
    }
    // The email, pointing at the person's own app.
    const role = found.data.role as 'student' | 'teacher' | 'admin'
    const sent = await anon.auth.resetPasswordForEmail(found.data.email as string, {
      redirectTo: resetAddress(deps.env, role),
    })
    if (sent.error) return refuse('unknown', 'The email could not be sent. Try again.')
    // 5. The audit entry: that a link was sent, not what it holds.
    const audit = await service.from('audit_logs').insert({
      actor_id: actorId,
      actor_role: 'admin',
      action: 'user.password_reset_sent',
      entity_type: 'user',
      entity_id: body.userId,
      metadata: {},
      created_at: deps.now().toISOString(),
    })
    if (audit.error) return refuse('unknown', 'Something went wrong. Try again.')
    return json({ ok: true })
  })
}
