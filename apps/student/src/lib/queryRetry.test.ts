/**
 * Tests for the rule that decides whether a failed request is tried again.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The error type the rule reads.
import { AppError, type AppErrorKind } from './errors'
// The rule under test.
import { shouldRetryQuery } from './queryRetry'

describe('shouldRetryQuery', () => {
  // Proves passing failures get one more attempt, since they may clear on their own.
  it.each<AppErrorKind>(['network', 'unknown'])('retries a %s error once', (kind) => {
    // Assert: first failure retries, second does not.
    expect(shouldRetryQuery(0, new AppError(kind, 'x'))).toBe(true)
    expect(shouldRetryQuery(1, new AppError(kind, 'x'))).toBe(false)
  })

  // Proves answers that won't change are shown at once instead of after a wasted retry.
  it.each<AppErrorKind>(['not_found', 'forbidden', 'unauthorized', 'validation', 'conflict'])(
    'never retries a %s error',
    (kind) => {
      // Assert.
      expect(shouldRetryQuery(0, new AppError(kind, 'x'))).toBe(false)
    },
  )

  // Proves a raw error (not yet converted) is treated like an unknown one.
  it('retries a raw error once', () => {
    // Assert.
    expect(shouldRetryQuery(0, new Error('boom'))).toBe(true)
  })
})
