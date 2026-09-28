/**
 * Tests for the sign-in, sign-up and password form rules (REQUIREMENTS.md FR-AUTH-3).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The schemas under test.
import {
  forgotPasswordSchema,
  newPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from './authSchemas'

/** The first error message a schema gives for `value`, or undefined when it passes. */
function firstError(schema: { safeParse: (value: unknown) => SafeResult }, value: unknown) {
  // Check the value without throwing.
  const result = schema.safeParse(value)
  // A pass has no message; a failure reports its first issue.
  return result.success ? undefined : result.error.issues[0]?.message
}

/** The part of zod's safeParse result these tests read. */
type SafeResult =
  // A pass.
  | { success: true }
  // A failure with its issues.
  | { success: false; error: { issues: { message: string; path: PropertyKey[] }[] } }

// A sign-up form that passes every rule; each test breaks one field.
const validSignUp = {
  fullName: 'Ada Obi',
  email: 'ada@example.com',
  password: 'password1',
  confirmPassword: 'password1',
  acceptTerms: true,
}

describe('newPasswordSchema', () => {
  // Proves a password meeting every rule passes.
  it('accepts 8 or more characters with a letter and a number', () => {
    expect(firstError(newPasswordSchema, 'abcdefg1')).toBeUndefined()
  })

  // Proves each rule from FR-AUTH-3 has its own clear message: [password, expected message].
  it.each([
    ['abc1', 'Use at least 8 characters.'],
    ['abcdefgh', 'Include at least one number.'],
    ['12345678', 'Include at least one letter.'],
    ['', 'Enter a password.'],
  ])('rejects %j with "%s"', (password, message) => {
    expect(firstError(newPasswordSchema, password)).toBe(message)
  })
})

describe('signInSchema', () => {
  // Proves normal sign-in input passes, with surrounding spaces removed from the email.
  it('accepts an email and password and trims the email', () => {
    // Act: parse input with stray spaces around the email.
    const parsed = signInSchema.parse({
      email: '  victory@example.com ',
      password: 'x',
      remember: false,
    })

    // Assert: the spaces are gone.
    expect(parsed.email).toBe('victory@example.com')
  })

  // Proves an empty email and a malformed email get different messages: [email, message].
  it.each([
    ['', 'Enter your email address.'],
    ['not-an-email', 'Enter a valid email address.'],
  ])('rejects the email %j', (email, message) => {
    expect(firstError(signInSchema, { email, password: 'x', remember: false })).toBe(message)
  })

  // Proves sign-in only needs a password, not a strong one (existing accounts may predate the rule).
  it('asks for a password but does not apply the new-password rules', () => {
    // An empty password is refused.
    expect(firstError(signInSchema, { email: 'a@b.co', password: '', remember: false })).toBe(
      'Enter your password.',
    )
    // A short one is fine at sign-in.
    expect(
      firstError(signInSchema, { email: 'a@b.co', password: 'x', remember: false }),
    ).toBeUndefined()
  })
})

describe('signUpSchema', () => {
  // Proves a complete, valid form passes and the name is trimmed.
  it('accepts a valid form and trims the full name', () => {
    expect(signUpSchema.parse({ ...validSignUp, fullName: '  Ada Obi  ' }).fullName).toBe('Ada Obi')
  })

  // Proves the name length limits from FR-AUTH-3: [name, message].
  it.each([
    ['', 'Enter your full name.'],
    ['A', 'Use at least 2 characters.'],
    ['   ', 'Enter your full name.'],
    ['A'.repeat(81), 'Use 80 characters or fewer.'],
  ])('rejects the full name %j', (fullName, message) => {
    expect(firstError(signUpSchema, { ...validSignUp, fullName })).toBe(message)
  })

  // Proves an 80-character name is still allowed (the boundary).
  it('accepts a full name of exactly 80 characters', () => {
    expect(firstError(signUpSchema, { ...validSignUp, fullName: 'A'.repeat(80) })).toBeUndefined()
  })

  // Proves the password rules apply to sign-up.
  it('applies the new-password rules', () => {
    expect(
      firstError(signUpSchema, { ...validSignUp, password: 'short', confirmPassword: 'short' }),
    ).toBe('Use at least 8 characters.')
  })

  // Proves a mismatched confirmation is reported on the confirm field, where the student looks.
  it('reports a mismatched confirmation on the confirm field', () => {
    // Act.
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: 'password2' })

    // Assert: exactly one issue, on confirmPassword.
    expect(result.success).toBe(false)
    expect(result.error?.issues).toMatchObject([
      { path: ['confirmPassword'], message: 'Passwords do not match.' },
    ])
  })

  // Proves the terms checkbox is required (FR-AUTH-2).
  it('requires the terms to be accepted', () => {
    expect(firstError(signUpSchema, { ...validSignUp, acceptTerms: false })).toBe(
      'Accept the Terms of Service and Privacy Policy to continue.',
    )
  })
})

describe('forgotPasswordSchema', () => {
  // Proves the forgot form checks the email format.
  it('checks the email format', () => {
    // A valid email passes.
    expect(firstError(forgotPasswordSchema, { email: 'a@b.co' })).toBeUndefined()
    // A malformed one does not.
    expect(firstError(forgotPasswordSchema, { email: 'nope' })).toBe('Enter a valid email address.')
  })
})

describe('resetPasswordSchema', () => {
  // Proves the reset form applies the password rules and the match check.
  it('applies the password rules and checks the confirmation', () => {
    // Valid and matching.
    expect(
      firstError(resetPasswordSchema, { password: 'password1', confirmPassword: 'password1' }),
    ).toBeUndefined()
    // Too weak.
    expect(
      firstError(resetPasswordSchema, { password: 'password', confirmPassword: 'password' }),
    ).toBe('Include at least one number.')
    // Not matching.
    expect(
      firstError(resetPasswordSchema, { password: 'password1', confirmPassword: 'password9' }),
    ).toBe('Passwords do not match.')
  })
})
