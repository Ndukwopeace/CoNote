/**
 * Tests for reading the code and message of a refused database call.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The error type every service throws.
import { AppError } from '@conote/core/errors'

// The unit under test.
import { databaseCode, databaseMessage } from './databaseErrors'

describe('databaseCode', () => {
  // Proves the code is read from a raw answer.
  it('reads the code of a raw answer', () => {
    expect(databaseCode({ code: '23505', message: 'duplicate' })).toBe('23505')
  })

  // Proves the code survives being wrapped in an AppError, which keeps the raw answer as its cause.
  it('reads the code from the cause of an AppError', () => {
    const wrapped = new AppError('conflict', 'x', { cause: { code: '40001', message: 'stale' } })
    expect(databaseCode(wrapped)).toBe('40001')
  })

  // Proves anything else has no code, instead of throwing.
  it.each([undefined, null, 'text', 42, {}, { code: 5 }])('has no code for %j', (value) => {
    expect(databaseCode(value)).toBeUndefined()
  })
})

describe('databaseMessage', () => {
  // Proves the message is read from a raw answer and from an AppError's cause.
  it('reads the message', () => {
    expect(databaseMessage({ message: 'course archived' })).toBe('course archived')
    expect(databaseMessage(new AppError('unknown', 'x', { cause: { message: 'inner' } }))).toBe(
      'inner',
    )
  })

  // Proves anything else has an empty message.
  it.each([undefined, null, 'text', {}, { message: 5 }])('is empty for %j', (value) => {
    expect(databaseMessage(value)).toBe('')
  })
})
