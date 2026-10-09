/**
 * Tests for the teacher-facing wording of each error kind.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type.
import { AppError, type AppErrorKind } from '@conote/core/errors'

// The unit under test.
import { errorMessage } from './errorMessages'

describe('errorMessage', () => {
  // Proves every kind has wording, and none of it is empty.
  it.each<AppErrorKind>([
    'network',
    'unauthorized',
    'forbidden',
    'not_found',
    'validation',
    'conflict',
    'unknown',
  ])('words the %s kind', (kind) => {
    expect(errorMessage(new AppError(kind, 'Safe detail.'))).not.toBe('')
  })

  // SECURITY: an unknown error's own message may hold internal details, so it is never shown.
  it('never shows the raw message of an unknown error', () => {
    const message = errorMessage(new AppError('unknown', 'relation "profiles" does not exist'))
    expect(message).not.toContain('profiles')
  })

  // Proves validation errors pass their safe, written-for-people message through.
  it('shows the message of a validation error', () => {
    expect(errorMessage(new AppError('validation', 'Course code is taken.'))).toBe(
      'Course code is taken.',
    )
  })

  // Proves the forbidden wording fits teachers, not students.
  it('tells a teacher who to ask about missing access', () => {
    expect(errorMessage(new AppError('forbidden', 'x'))).toContain('an administrator')
  })
})
