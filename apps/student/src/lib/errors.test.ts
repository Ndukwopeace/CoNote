/**
 * Tests for error normalisation and the student-facing wording.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The error type and converter under test.
import { AppError, toAppError } from './errors'
// The wording under test.
import { errorMessage } from './errorMessages'

describe('toAppError', () => {
  // Proves AppErrors aren't wrapped twice, which would lose their kind.
  it('returns an AppError unchanged', () => {
    // Arrange: an existing AppError.
    const error = new AppError('not_found', 'Note not found')

    // Assert: the very same object comes back.
    expect(toAppError(error)).toBe(error)
  })

  // Proves a dropped connection is recognised, so the student is told to check it.
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

describe('errorMessage', () => {
  // Proves the network message tells the student what to do.
  it('tells the student what to do after a network error', () => {
    expect(errorMessage(new AppError('network', 'offline'))).toMatch(/connection/i)
  })

  // SECURITY: proves internal error text never reaches the screen.
  it('never shows the raw message of an unknown error', () => {
    expect(errorMessage(new AppError('unknown', 'TypeError: x is undefined'))).not.toMatch(
      /TypeError/,
    )
  })

  // Proves validation messages, which are written for students, are shown as written.
  it('shows the safe message of a validation error', () => {
    expect(errorMessage(new AppError('validation', 'Enter a valid email address.'))).toBe(
      'Enter a valid email address.',
    )
  })
})

describe('errorMessage for every kind', () => {
  // Proves every kind has its own helpful wording.
  it.each([
    ['network', /connection/i],
    ['unauthorized', /sign in again/i],
    ['forbidden', /access/i],
    ['not_found', /couldn't find/i],
    ['conflict', /reload/i],
    ['unknown', /try again/i],
  ] as const)('gives a student-facing message for %s', (kind, expected) => {
    expect(errorMessage(new AppError(kind, 'internal detail'))).toMatch(expected)
  })

  // SECURITY: proves no kind except validation leaks the internal message.
  it.each(['network', 'unauthorized', 'forbidden', 'not_found', 'conflict', 'unknown'] as const)(
    'does not leak the internal message for %s',
    (kind) => {
      expect(errorMessage(new AppError(kind, 'internal detail'))).not.toContain('internal detail')
    },
  )
})
