/**
 * Tests for error normalisation: everything thrown becomes an AppError.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The error type and converter under test.
import { AppError, toAppError } from './errors'

describe('toAppError', () => {
  // Proves AppErrors aren't wrapped twice, which would lose their kind.
  it('returns an AppError unchanged', () => {
    // Arrange: an existing AppError.
    const error = new AppError('not_found', 'Note not found')

    // Assert: the very same object comes back.
    expect(toAppError(error)).toBe(error)
  })

  // Proves a dropped connection is recognised, so the user is told to check it.
  it('treats a failed fetch as a network error', () => {
    // Act: convert the browser's fetch failure.
    const result = toAppError(new TypeError('Failed to fetch'))

    // Assert.
    expect(result.kind).toBe('network')
  })

  // Proves unexpected errors are wrapped but not lost; developers still get the original.
  it('wraps anything else as unknown and keeps the original as the cause', () => {
    // Arrange.
    const original = new Error('boom')

    // Act.
    const result = toAppError(original)

    // Assert: generic kind, original kept.
    expect(result.kind).toBe('unknown')
    expect(result.cause).toBe(original)
  })

  // Proves even a thrown string is handled.
  it('handles values that are not errors', () => {
    expect(toAppError('oops').kind).toBe('unknown')
  })
})
