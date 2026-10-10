/**
 * Tests for calling an Edge Function and reading its answer.
 */

// The error the SDK raises, and the client type.
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The unit under test.
import { invokeThrough, unwrap } from './functionCall'

/** A client whose `functions.invoke` answers with `result`. */
function clientAnswering(result: { data: unknown; error: unknown }) {
  const invoke = vi.fn(() => Promise.resolve(result))
  return { client: { functions: { invoke } } as unknown as SupabaseClient, invoke }
}

describe('invokeThrough', () => {
  // Proves a successful call returns its data with the body sent as JSON.
  it('returns the data of a successful call', async () => {
    const { client, invoke } = clientAnswering({ data: { userId: 'u1' }, error: null })
    await expect(invokeThrough(client)('invite-user', { email: 'a@b.co' })).resolves.toEqual({
      status: 200,
      body: { userId: 'u1' },
    })
    expect(invoke).toHaveBeenCalledWith('invite-user', { body: { email: 'a@b.co' } })
  })

  // Proves a refusal keeps its status and its JSON.
  it('returns the status and JSON of a refusal', async () => {
    const response = Response.json(
      { error: { kind: 'conflict', message: 'Taken.' } },
      { status: 409 },
    )
    const { client } = clientAnswering({ data: null, error: new FunctionsHttpError(response) })
    await expect(invokeThrough(client)('x', {})).resolves.toEqual({
      status: 409,
      body: { error: { kind: 'conflict', message: 'Taken.' } },
    })
  })

  // Proves a refusal that is not JSON still returns its status.
  it('copes with a refusal that is not JSON', async () => {
    const { client } = clientAnswering({
      data: null,
      error: new FunctionsHttpError(new Response('<html>', { status: 500 })),
    })
    await expect(invokeThrough(client)('x', {})).resolves.toEqual({ status: 500, body: null })
  })

  // Proves a function that cannot be reached is a network error.
  it('reports an unreachable function as a network error', async () => {
    const { client } = clientAnswering({
      data: null,
      error: new FunctionsFetchError(new Error('offline')),
    })
    await expect(invokeThrough(client)('x', {})).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('unwrap', () => {
  // Proves success passes the body through.
  it('returns the body of a successful answer', () => {
    expect(unwrap({ status: 200, body: { ok: true } })).toEqual({ ok: true })
  })

  // Proves each known kind becomes the error a screen handles, with the function's message.
  it.each(['unauthorized', 'forbidden', 'validation', 'not_found', 'conflict'])(
    'turns a %s refusal into an AppError of that kind',
    (kind) => {
      expect(() => unwrap({ status: 400, body: { error: { kind, message: 'Words.' } } })).toThrow(
        expect.objectContaining({ kind, message: 'Words.' }),
      )
    },
  )

  // SECURITY: proves an answer of the wrong shape never becomes a message on a screen.
  it('turns an unexpected answer into a generic unknown error', () => {
    expect(() =>
      unwrap({ status: 500, body: { error: { kind: 'wizard', message: 'raw' } } }),
    ).toThrow(expect.objectContaining({ kind: 'unknown', message: 'Unexpected error' }))
    expect(() => unwrap({ status: 502, body: null })).toThrow(
      expect.objectContaining({ kind: 'unknown', message: 'Unexpected error' }),
    )
  })
})
