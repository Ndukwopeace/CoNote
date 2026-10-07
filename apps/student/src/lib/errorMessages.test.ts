/**
 * Tests for the student-facing wording of each error kind.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type (packages/core).
import { AppError } from '@conote/core/errors'

// The wording under test.
import { errorMessage } from './errorMessages'

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
