/**
 * Tests for send-password-reset: who gets a link, where it points, and what is recorded.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { sendPasswordResetHandler } from './sendPasswordReset.ts'
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
  return { ...made, handler: sendPasswordResetHandler(made.deps) }
}

/** An active student. */
const STUDENT = { email: 'ada@conote.example', role: 'student', status: 'active' }

describe('send-password-reset', () => {
  // Proves an active account gets a link to its own app, and the audit entry holds no link.
  it('sends the link and records that it was sent', async () => {
    const { handler, resetPasswordForEmail, queries } = build(STUDENT)
    const response = await handler(post({ userId: OTHER_ID }))
    expect(response.status).toBe(200)
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ada@conote.example', {
      redirectTo: 'https://app.example/reset-password',
    })
    expect(sentTo(queries, 'audit_logs', 'insert')).toEqual({
      actor_id: ADMIN_ID,
      actor_role: 'admin',
      action: 'user.password_reset_sent',
      entity_type: 'user',
      entity_id: OTHER_ID,
      metadata: {},
      created_at: NOW.toISOString(),
    })
  })

  // Proves staff get the link for their own portal.
  it('points a teacher at the teacher portal', async () => {
    const { handler, resetPasswordForEmail } = build({ ...STUDENT, role: 'teacher' })
    await handler(post({ userId: OTHER_ID }))
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ada@conote.example', {
      redirectTo: 'https://teacher.example/teacher/reset-password',
    })
  })

  // Proves only active accounts get a link.
  it.each(['suspended', 'inactive', 'pending'])('refuses a %s account', async (status) => {
    const { handler, resetPasswordForEmail } = build({ ...STUDENT, status })
    const response = await handler(post({ userId: OTHER_ID }))
    expect(response.status).toBe(400)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { message: 'Only active accounts can be sent a reset link.' },
    })
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  // Proves bad input and unknown accounts are refused.
  it('refuses a bad ID and reports an unknown account', async () => {
    expect((await build(STUDENT).handler(post({ userId: 'nobody' }))).status).toBe(400)
    expect((await build(null).handler(post({ userId: OTHER_ID }))).status).toBe(404)
  })

  // Proves each failing step is reported.
  it('reports a failed lookup, email and audit entry', async () => {
    const failed = { data: null, error: { code: 'XX000' } }
    expect(
      (await build(STUDENT, { 'profiles:select': failed }).handler(post({ userId: OTHER_ID })))
        .status,
    ).toBe(502)
    expect(
      (await build(STUDENT, { 'audit_logs:insert': failed }).handler(post({ userId: OTHER_ID })))
        .status,
    ).toBe(502)
    const emailFails = build(STUDENT)
    emailFails.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { code: 'x' } })
    const response = await emailFails.handler(post({ userId: OTHER_ID }))
    expect(response.status).toBe(502)
    expect(sentTo(emailFails.queries, 'audit_logs', 'insert')).toBeUndefined()
  })
})
