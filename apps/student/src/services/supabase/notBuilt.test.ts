/**
 * Tests for the stand-in used for services that are not connected to the database yet.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The error type a failure must be.
import { AppError } from '@conote/core/errors'

// The function under test.
import { notBuilt } from './notBuilt'

describe('notBuilt', () => {
  // Proves every method fails with a message naming the service, so a half-connected deploy is
  // obvious instead of silently empty.
  it('rejects every call with a clear message', async () => {
    const notes = notBuilt<{ listMyNotes(): Promise<never[]> }>('Notes')
    const attempt = notes.listMyNotes()
    await expect(attempt).rejects.toBeInstanceOf(AppError)
    await expect(attempt).rejects.toMatchObject({
      kind: 'unknown',
      message: 'Notes is not connected to the database yet.',
    })
  })

  // Proves the failure is asynchronous, as with a real call, so callers' error handling works.
  it('never throws synchronously', () => {
    const service = notBuilt<{ anything(): Promise<void> }>('Anything')
    expect(() => {
      void service.anything().catch(() => undefined)
    }).not.toThrow()
  })
})
