/**
 * Tests for the steps every admin function starts with: who may call, and what is checked before
 * the function's own work runs.
 */

// Vitest building blocks, and the schema the test function uses.
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

// The unit under test.
import { adminHandler } from './admin.ts'
import { json } from './http.ts'
import { ADMIN_ID, bodyOf, post, profile, setupFunction } from '../testSupport.ts'

/** A handler that does one trivial thing, so only the shared steps are tested. */
function build(answerProfile: unknown, caller: string | null = ADMIN_ID) {
  const { deps } = setupFunction({
    answer: () => ({ data: answerProfile, error: null }),
    caller,
  })
  const run = vi.fn(() => Promise.resolve(json({ ok: true })))
  return {
    handler: adminHandler(deps, z.object({ name: z.string().min(1, 'Enter a name.') }), run),
    run,
  }
}

describe('adminHandler', () => {
  // Proves a browser's preflight question is answered without any checks.
  it('answers a preflight', async () => {
    const { handler, run } = build(profile())
    const response = await handler(post(null, null, 'OPTIONS'))
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization')
    expect(run).not.toHaveBeenCalled()
  })

  // Proves only POST is accepted.
  it('refuses other methods', async () => {
    const { handler } = build(profile())
    expect((await handler(post(null, 'good-token', 'GET'))).status).toBe(400)
  })

  // SECURITY: proves a missing, malformed or forged token is turned away with 401.
  it.each([
    ['no token', null, ADMIN_ID],
    ['a token nobody owns', 'forged', null],
  ])('turns away %s with 401', async (_name, token, caller) => {
    const { handler, run } = build(profile(), caller)
    const response = await handler(post({ name: 'x' }, token))
    expect(response.status).toBe(401)
    await expect(bodyOf(response)).resolves.toEqual({
      error: { kind: 'unauthorized', message: 'Sign in again to continue.' },
    })
    expect(run).not.toHaveBeenCalled()
  })

  // SECURITY: proves a student, a teacher, a suspended administrator and a stranger all get 403,
  // whatever they send.
  it.each([
    ['a student', profile({ role: 'student' })],
    ['a teacher', profile({ role: 'teacher' })],
    ['a suspended administrator', profile({ status: 'suspended' })],
    ['an invited administrator', profile({ status: 'pending' })],
    ['someone with no profile', null],
  ])('turns away %s with 403', async (_name, row) => {
    const { handler, run } = build(row)
    const response = await handler(post({ name: 'x' }))
    expect(response.status).toBe(403)
    expect(run).not.toHaveBeenCalled()
  })

  // Proves a failed profile read is reported without revealing why.
  it('reports a failed profile read', async () => {
    const { deps } = setupFunction({ answer: () => ({ data: null, error: { code: 'XX000' } }) })
    const handler = adminHandler(deps, z.object({}), () => Promise.resolve(json({})))
    expect((await handler(post({}))).status).toBe(502)
  })

  // Proves a body that is not JSON, or breaks the schema, is refused with the first message.
  it('refuses a bad body', async () => {
    const { handler, run } = build(profile())
    const notJson = await handler(post('{nope'))
    expect(notJson.status).toBe(400)
    const invalid = await handler(post({ name: '' }))
    expect(invalid.status).toBe(400)
    await expect(bodyOf(invalid)).resolves.toEqual({
      error: { kind: 'validation', message: 'Enter a name.' },
    })
    expect(run).not.toHaveBeenCalled()
  })

  // Proves an active administrator's valid request reaches the function with their ID.
  it('runs the function for an active administrator', async () => {
    const { handler, run } = build(profile())
    const response = await handler(post({ name: 'ok' }))
    expect(response.status).toBe(200)
    expect(run).toHaveBeenCalledWith({ actorId: ADMIN_ID, body: { name: 'ok' } })
  })
})
