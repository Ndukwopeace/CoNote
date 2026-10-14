/**
 * Tests for delete-invitation: only an invitation nobody has accepted can be deleted, and the
 * login goes with it.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { deleteInvitationHandler } from './deleteInvitation.ts'
import {
  ADMIN_ID,
  NOW,
  OTHER_ID,
  bodyOf,
  post,
  route,
  sentTo,
  setupFunction,
} from '../testSupport.ts'

/** A handler over an account, unless `routes` says otherwise. */
function build(account: unknown, routes = {}) {
  const made = setupFunction({
    answer: route({ 'profiles:select': { data: account, error: null }, ...routes }),
  })
  return { ...made, handler: deleteInvitationHandler(made.deps) }
}

/** An invited teacher. */
const INVITED = { role: 'teacher', status: 'pending' }

describe('delete-invitation', () => {
  // Proves the login is removed (the profile goes with it) and who did it is recorded, with the
  // role and nothing that identifies the person.
  it('deletes the login and records the deletion', async () => {
    const { handler, admin, queries } = build(INVITED)
    const response = await handler(post({ userId: OTHER_ID }))
    expect(response.status).toBe(200)
    expect(admin.deleteUser).toHaveBeenCalledWith(OTHER_ID)
    expect(sentTo(queries, 'audit_logs', 'insert')).toEqual({
      actor_id: ADMIN_ID,
      actor_role: 'admin',
      action: 'user.invitation_deleted',
      entity_type: 'user',
      entity_id: OTHER_ID,
      metadata: { role: 'teacher' },
      created_at: NOW.toISOString(),
    })
  })

  // Proves anyone who has signed in, or was blocked, is kept: their notes and history stay.
  it.each(['active', 'inactive', 'suspended'])('refuses a %s account', async (status) => {
    const { handler, admin } = build({ ...INVITED, status })
    const response = await handler(post({ userId: OTHER_ID }))
    expect(response.status).toBe(400)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { message: 'Only an invitation that has not been accepted can be deleted.' },
    })
    expect(admin.deleteUser).not.toHaveBeenCalled()
  })

  // Proves an administrator can't delete their own account.
  it('refuses to delete the caller', async () => {
    const { handler, admin } = build(INVITED)
    const response = await handler(post({ userId: ADMIN_ID }))
    expect(response.status).toBe(400)
    expect(admin.deleteUser).not.toHaveBeenCalled()
  })

  // Proves bad input and unknown accounts are refused.
  it('refuses a bad ID and reports an unknown account', async () => {
    expect((await build(INVITED).handler(post({ userId: 'nobody' }))).status).toBe(400)
    expect((await build(null).handler(post({ userId: OTHER_ID }))).status).toBe(404)
  })

  // Proves each failing step is reported, and that the audit entry is only written once the
  // login is really gone.
  it('reports a failed lookup, deletion and audit entry', async () => {
    const failed = { data: null, error: { code: 'XX000' } }
    expect(
      (await build(INVITED, { 'profiles:select': failed }).handler(post({ userId: OTHER_ID })))
        .status,
    ).toBe(502)
    expect(
      (await build(INVITED, { 'audit_logs:insert': failed }).handler(post({ userId: OTHER_ID })))
        .status,
    ).toBe(502)
    const deleteFails = build(INVITED)
    deleteFails.admin.deleteUser.mockResolvedValueOnce({ data: null, error: { code: 'x' } })
    const response = await deleteFails.handler(post({ userId: OTHER_ID }))
    expect(response.status).toBe(502)
    expect(sentTo(deleteFails.queries, 'audit_logs', 'insert')).toBeUndefined()
  })
})
