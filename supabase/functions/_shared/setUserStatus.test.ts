/**
 * Tests for set-user-status: the rules it holds, and that a changed status also ends the account's
 * ability to sign in.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { setUserStatusHandler } from './setUserStatus.ts'
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

/** A handler over an account in `status`, unless `routes` says otherwise. */
function build(status: string | null, routes = {}) {
  const made = setupFunction({
    answer: route({
      'profiles:select': { data: status === null ? null : { status }, error: null },
      ...routes,
    }),
  })
  return { ...made, handler: setUserStatusHandler(made.deps) }
}

describe('set-user-status', () => {
  // Proves a suspension changes the profile, bans the login, and is recorded with who and why.
  it('suspends an account, bans the login and records it', async () => {
    const { handler, admin, queries } = build('active')
    const response = await handler(post({ userId: OTHER_ID, status: 'suspended' }))
    expect(response.status).toBe(200)
    expect(sentTo(queries, 'profiles', 'update')).toEqual({ status: 'suspended' })
    // SECURITY: the account can't sign in again or refresh a session.
    expect(admin.updateUserById).toHaveBeenCalledWith(OTHER_ID, { ban_duration: '876000h' })
    expect(sentTo(queries, 'audit_logs', 'insert')).toMatchObject({
      actor_id: ADMIN_ID,
      actor_role: 'admin',
      action: 'user.status_changed',
      entity_type: 'user',
      entity_id: OTHER_ID,
      metadata: { from: 'active', to: 'suspended' },
      created_at: NOW.toISOString(),
    })
  })

  // Proves activating lifts the ban.
  it('lifts the ban when an account is activated', async () => {
    const { handler, admin } = build('suspended')
    await handler(post({ userId: OTHER_ID, status: 'active' }))
    expect(admin.updateUserById).toHaveBeenCalledWith(OTHER_ID, { ban_duration: 'none' })
  })

  // SECURITY: proves an administrator can't lock themselves out.
  it('refuses a change to the administrator’s own account', async () => {
    const { handler, admin } = build('active')
    const response = await handler(post({ userId: ADMIN_ID, status: 'inactive' }))
    expect(response.status).toBe(400)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { message: "You can't change your own account's status." },
    })
    expect(admin.updateUserById).not.toHaveBeenCalled()
  })

  // Proves the rules: suspended accounts can only be activated, an invitation can only be withdrawn.
  it.each([
    ['suspended', 'inactive'],
    ['active', 'active'],
    ['pending', 'suspended'],
    ['pending', 'active'],
  ])('refuses %s to %s', async (from, to) => {
    const { handler, admin } = build(from)
    const response = await handler(post({ userId: OTHER_ID, status: to }))
    expect(response.status).toBe(400)
    expect(admin.updateUserById).not.toHaveBeenCalled()
  })

  // Proves an invitation can be withdrawn.
  it('withdraws an invitation', async () => {
    const { handler } = build('pending')
    expect((await handler(post({ userId: OTHER_ID, status: 'inactive' }))).status).toBe(200)
  })

  // Proves bad input is refused: pending can't be chosen, and the ID must be an ID.
  it.each([
    [{ userId: OTHER_ID, status: 'pending' }],
    [{ userId: 'nobody', status: 'active' }],
    [{ status: 'active' }],
  ])('refuses invalid input %#', async (body) => {
    const { handler } = build('active')
    expect((await handler(post(body))).status).toBe(400)
  })

  // Proves an unknown account is not found.
  it('reports an unknown account', async () => {
    const { handler } = build(null)
    expect((await handler(post({ userId: OTHER_ID, status: 'active' }))).status).toBe(404)
  })

  // Proves each failing step is reported.
  it('reports a failed lookup, update, ban and audit entry', async () => {
    const failed = { data: null, error: { code: 'XX000' } }
    expect(
      (
        await build('active', { 'profiles:select': failed }).handler(
          post({ userId: OTHER_ID, status: 'suspended' }),
        )
      ).status,
    ).toBe(502)
    expect(
      (
        await build('active', { 'profiles:update': failed }).handler(
          post({ userId: OTHER_ID, status: 'suspended' }),
        )
      ).status,
    ).toBe(502)
    expect(
      (
        await build('active', { 'audit_logs:insert': failed }).handler(
          post({ userId: OTHER_ID, status: 'suspended' }),
        )
      ).status,
    ).toBe(502)
    const banFails = build('active')
    banFails.admin.updateUserById.mockResolvedValueOnce({ data: {}, error: { code: 'x' } })
    const response = await banFails.handler(post({ userId: OTHER_ID, status: 'suspended' }))
    expect(response.status).toBe(502)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { message: 'The status changed, but sessions could not be ended.' },
    })
  })
})
