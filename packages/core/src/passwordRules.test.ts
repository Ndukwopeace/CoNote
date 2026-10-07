/**
 * Tests for the shared new-password rules.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { createNewPasswordSchema } from './passwordRules'

/** The first message for `value`, or undefined when it passes. */
function firstError(minLength: number, value: string) {
  return createNewPasswordSchema(minLength).safeParse(value).error?.issues[0]?.message
}

describe('createNewPasswordSchema', () => {
  // Proves a password meeting every rule passes.
  it('accepts a long enough password with a letter and a number', () => {
    expect(firstError(8, 'abcdefg1')).toBeUndefined()
  })

  // Proves each rule has its own message, and the length follows the app's setting.
  it.each([
    [8, '', 'Enter a password.'],
    [8, 'abc1', 'Use at least 8 characters.'],
    [12, 'abcdefgh123', 'Use at least 12 characters.'],
    [8, '12345678', 'Include at least one letter.'],
    [8, 'abcdefgh', 'Include at least one number.'],
  ])('with a %i-character minimum, rejects "%s"', (minLength, value, message) => {
    expect(firstError(minLength, value)).toBe(message)
  })

  // Proves letters from any alphabet count, not only a to z.
  it('counts letters from any alphabet', () => {
    expect(firstError(8, 'ééééééé1')).toBeUndefined()
  })
})
