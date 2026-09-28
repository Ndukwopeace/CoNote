import { describe, expect, it } from 'vitest'

import { AppError, toAppError } from './errors'
import { errorMessage } from './errorMessages'

describe('toAppError', () => {
  it('returns an AppError unchanged', () => {
    const error = new AppError('not_found', 'Note not found')

    expect(toAppError(error)).toBe(error)
  })

  it('treats a failed fetch as a network error', () => {
    const result = toAppError(new TypeError('Failed to fetch'))

    expect(result.kind).toBe('network')
  })

  it('wraps anything else as unknown and keeps the original as the cause', () => {
    const original = new Error('boom')

    const result = toAppError(original)

    expect(result.kind).toBe('unknown')
    expect(result.cause).toBe(original)
  })

  it('handles values that are not errors', () => {
    expect(toAppError('oops').kind).toBe('unknown')
  })
})

describe('errorMessage', () => {
  it('tells the student what to do after a network error', () => {
    expect(errorMessage(new AppError('network', 'offline'))).toMatch(/connection/i)
  })

  it('never shows the raw message of an unknown error', () => {
    expect(errorMessage(new AppError('unknown', 'TypeError: x is undefined'))).not.toMatch(
      /TypeError/,
    )
  })

  it('shows the safe message of a validation error', () => {
    expect(errorMessage(new AppError('validation', 'Enter a valid email address.'))).toBe(
      'Enter a valid email address.',
    )
  })
})

describe('errorMessage for every kind', () => {
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

  it.each(['network', 'unauthorized', 'forbidden', 'not_found', 'conflict', 'unknown'] as const)(
    'does not leak the internal message for %s',
    (kind) => {
      expect(errorMessage(new AppError(kind, 'internal detail'))).not.toContain('internal detail')
    },
  )
})
