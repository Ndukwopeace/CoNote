/**
 * Tests for delete-user: an administrator removes any account but their own, and the login goes
 * with it (the profile, notes and enrolments follow by cascade).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { deleteUserHandler } from './deleteUser.ts'
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
  return { ...made, handler: deleteUserHandler(made.deps) }
}

/** An active student. */
const STUDENT = { role: 'student', status: 'active' }

describe('delete-user', () => {
  // Proves the login is removed and who did it is recorded, with the role and nothing that
  // identifies the person.
  it.each(['active', 'inactive', 'suspended', 'pending'])(
    'deletes a %s account and records the deletion',
    async (status) => {
      const { handler, admin, queries } = build({ ...STUDENT, status })
      const response = await handler(post({ userId: OTHER_ID }))
      expect(response.status).toBe(200)
      expect(admin.deleteUser).toHaveBeenCalledWith(OTHER_ID)
      expect(sentTo(queries, 'audit_logs', 'insert')).toEqual({
        actor_id: ADMIN_ID,
        actor_role: 'admin',
        action: 'user.deleted',
        entity_type: 'user',
        entity_id: OTHER_ID,
        metadata: { role: 'student' },
        created_at: NOW.toISOString(),
      })
    },
  )

  // Proves an administrator can't delete their own account.
  it('refuses to delete the caller', async () => {
    const { handler, admin } = build(STUDENT)
    const response = await handler(post({ userId: ADMIN_ID }))
    expect(response.status).toBe(400)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { message: "You can't delete your own account." },
    })
    expect(admin.deleteUser).not.toHaveBeenCalled()
  })

  // Proves bad input and unknown accounts are refused.
  it('refuses a bad ID and reports an unknown account', async () => {
    expect((await build(STUDENT).handler(post({ userId: 'nobody' }))).status).toBe(400)
    expect((await build(null).handler(post({ userId: OTHER_ID }))).status).toBe(404)
  })

  // Proves each failing step is reported, and that the audit entry is only written once the
  // login is really gone.
  it('reports a failed lookup, deletion and audit entry', async () => {
    const failed = { data: null, error: { code: 'XX000' } }
    expect(
      (await build(STUDENT, { 'profiles:select': failed }).handler(post({ userId: OTHER_ID })))
        .status,
    ).toBe(502)
    expect(
      (await build(STUDENT, { 'audit_logs:insert': failed }).handler(post({ userId: OTHER_ID })))
        .status,
    ).toBe(502)
    const deleteFails = build(STUDENT)
    deleteFails.admin.deleteUser.mockResolvedValueOnce({ data: null, error: { code: 'x' } })
    const response = await deleteFails.handler(post({ userId: OTHER_ID }))
    expect(response.status).toBe(502)
    expect(sentTo(deleteFails.queries, 'audit_logs', 'insert')).toBeUndefined()
  })
})
