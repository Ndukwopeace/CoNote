/**
 * delete-invitation: an administrator deletes an invitation nobody has accepted (admin
 * REQUIREMENTS section 11), for example one sent to a wrong address or with the wrong role. Only a
 * "pending" account can go: it has never signed in, so it has no notes or history to lose. Anyone
 * else is deactivated instead, which keeps what they wrote.
 */

// Checks the body.
import { z } from 'zod'

// The shared steps and answers.
import { adminHandler, type FunctionDeps } from './admin.ts'
import { json, refuse } from './http.ts'
import { canDeleteInvitation, type AccountStatus } from './rules.ts'

/** The body. */
const bodySchema = z.object({ userId: z.uuid('Choose a person.') })

/** Builds the handler. */
export function deleteInvitationHandler(deps: FunctionDeps) {
  return adminHandler(deps, bodySchema, async ({ actorId, body }) => {
    const { service } = deps.clients
    // SECURITY: an administrator can't delete their own account and lose access.
    if (body.userId === actorId) {
      return refuse('validation', "You can't delete your own account.")
    }
    // The account as it is now.
    const found = await service
      .from('profiles')
      .select('role, status')
      .eq('id', body.userId)
      .maybeSingle()
    if (found.error) return refuse('unknown', 'Something went wrong. Try again.')
    if (!found.data) return refuse('not_found', 'User not found.')
    // SECURITY: only an unaccepted invitation can be deleted, so this can never remove a person
    // who has notes, courses or history.
    if (!canDeleteInvitation(found.data.status as AccountStatus)) {
      return refuse('validation', 'Only an invitation that has not been accepted can be deleted.')
    }
    // The login. The profile goes with it (it is deleted along with the login).
    const deleted = await service.auth.admin.deleteUser(body.userId)
    if (deleted.error) return refuse('unknown', 'Something went wrong. Try again.')
    // 5. The audit entry: who deleted an invitation, and its role. Never the person's name or
    // email, which are gone with the account.
    const audit = await service.from('audit_logs').insert({
      actor_id: actorId,
      actor_role: 'admin',
      action: 'user.invitation_deleted',
      entity_type: 'user',
      entity_id: body.userId,
      metadata: { role: found.data.role as string },
      created_at: deps.now().toISOString(),
    })
    if (audit.error) return refuse('unknown', 'Something went wrong. Try again.')
    return json({ ok: true })
  })
}
