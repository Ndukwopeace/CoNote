/**
 * delete-user: an administrator permanently removes an account (admin REQUIREMENTS section 11).
 * The login goes, and with it the profile, the person's notes, enrolments and requests (they
 * cascade); courses they taught are left without a teacher. Deactivating keeps everything, so the
 * console asks the administrator to type the person's name before it calls this.
 */

// Checks the body.
import { z } from 'zod'

// The shared steps and answers.
import { adminHandler, type FunctionDeps } from './admin.ts'
import { json, refuse } from './http.ts'

/** The body. */
const bodySchema = z.object({ userId: z.uuid('Choose a person.') })

/** Builds the handler. */
export function deleteUserHandler(deps: FunctionDeps) {
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
    // The login. The profile and everything the person owns goes with it.
    const deleted = await service.auth.admin.deleteUser(body.userId)
    if (deleted.error) return refuse('unknown', 'Something went wrong. Try again.')
    // The audit entry: who deleted an account, and its role. Never the person's name or email,
    // which are gone with the account. Written only after the login is gone.
    const audit = await service.from('audit_logs').insert({
      actor_id: actorId,
      actor_role: 'admin',
      action: 'user.deleted',
      entity_type: 'user',
      entity_id: body.userId,
      metadata: { role: found.data.role as string },
      created_at: deps.now().toISOString(),
    })
    if (audit.error) return refuse('unknown', 'Something went wrong. Try again.')
    return json({ ok: true })
  })
}
