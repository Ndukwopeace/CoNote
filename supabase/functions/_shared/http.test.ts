/**
 * Tests for the shared answers every Edge Function gives. The headers matter because these
 * answers carry one person's data: a cache must not keep them, and a browser must not guess
 * that JSON is something else.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

import { json, preflight, refuse } from './http.ts'

describe('shared answers', () => {
  // Proves a success answer is JSON that no cache keeps and no browser reinterprets.
  it('sends JSON with no-store and nosniff', async () => {
    const answer = json({ ok: true })

    expect(answer.status).toBe(200)
    expect(answer.headers.get('Content-Type')).toBe('application/json')
    expect(answer.headers.get('Cache-Control')).toBe('no-store')
    expect(answer.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await answer.json()).toEqual({ ok: true })
  })

  // Proves a refusal has the same protections and the right status.
  it('gives a refusal the same headers and its status', () => {
    const answer = refuse('forbidden', 'No.')

    expect(answer.status).toBe(403)
    expect(answer.headers.get('Cache-Control')).toBe('no-store')
    expect(answer.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  // Proves the browser's preflight question is answered without a body and with the allowed calls.
  it('answers a preflight with no body', () => {
    const answer = preflight()

    expect(answer.status).toBe(204)
    expect(answer.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect(answer.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})
