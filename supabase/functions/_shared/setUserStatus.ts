/**
 * set-user-status: an administrator activates, deactivates or suspends an account (admin
 * REQUIREMENTS section 11). The new status is what the database's policies and the apps' sign-in
 * check; the account is also banned in Supabase Auth, so it cannot sign in again or refresh a
 * session. A session already open keeps working until its token expires (at most an hour).
 */

// Checks the body.
import { z } from 'zod'

// The shared steps and answers.
import { adminHandler, type FunctionDeps } from './admin.ts'
import { json, refuse } from './http.ts'
import { canChangeStatus, type AccountStatus } from './rules.ts'

/** How long a ban lasts: effectively forever, until the account is activated again. */
const BAN = '876000h'

/** The body. */
const bodySchema = z.object({
  userId: z.uuid('Choose a person.'),
  // "pending" is only ever set by an invitation.
  status: z.enum(['active', 'inactive', 'suspended']),
})

/** Builds the handler. */
export function setUserStatusHandler(deps: FunctionDeps) {
  return adminHandler(deps, bodySchema, async ({ actorId, body }) => {
    const { service } = deps.clients
    // SECURITY: an administrator can't deactivate or suspend themselves and lose access.
    if (body.userId === actorId) {
      return refuse('validation', "You can't change your own account's status.")
    }
    // The account as it is now.
    const found = await service
      .from('profiles')
      .select('status')
      .eq('id', body.userId)
      .maybeSingle()
    if (found.error) return refuse('unknown', 'Something went wrong. Try again.')
    if (!found.data) return refuse('not_found', 'User not found.')
    const from = found.data.status as AccountStatus
    // Only the changes the rules allow.
    if (!canChangeStatus(from, body.status)) {
      return refuse('validation', 'This status change isn’t allowed.')
    }
    // The new status, which is what Row Level Security and sign-in read.
    const updated = await service
      .from('profiles')
      .update({ status: body.status })
      .eq('id', body.userId)
    if (updated.error) return refuse('unknown', 'Something went wrong. Try again.')
    // SECURITY: an account that is not active can't sign in again or refresh a session.
    const banned = await service.auth.admin.updateUserById(body.userId, {
      ban_duration: body.status === 'active' ? 'none' : BAN,
    })
    if (banned.error)
      return refuse('unknown', 'The status changed, but sessions could not be ended.')
    // 5. The audit entry that the account's history is read from.
    const audit = await service.from('audit_logs').insert({
      actor_id: actorId,
      actor_role: 'admin',
      action: 'user.status_changed',
      entity_type: 'user',
      entity_id: body.userId,
      metadata: { from, to: body.status },
      created_at: deps.now().toISOString(),
    })
    if (audit.error) return refuse('unknown', 'Something went wrong. Try again.')
    return json({ ok: true })
  })
}
