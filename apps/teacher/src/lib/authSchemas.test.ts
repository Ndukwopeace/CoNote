/**
 * Tests for the portal's sign-in and password form rules.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { forgotPasswordSchema, resetPasswordSchema, signInSchema } from './authSchemas'

/** Every message the schema gives for `value`, in order. */
function messages(
  schema: { safeParse: (value: unknown) => { error?: { issues: { message: string }[] } } },
  value: unknown,
) {
  return schema.safeParse(value).error?.issues.map((issue) => issue.message) ?? []
}

describe('signInSchema', () => {
  // Proves good input passes, with the email tidied.
  it('accepts an email and password, trimming the email', () => {
    expect(signInSchema.parse({ email: ' Teacher@CoNote.example ', password: 'x' })).toEqual({
      email: 'teacher@conote.example',
      password: 'x',
    })
  })

  // Proves the messages a person sees for empty or wrong fields.
  it('explains what is missing', () => {
    expect(messages(signInSchema, { email: 'not-an-email', password: '' })).toEqual([
      'Enter a valid email address.',
      'Enter your password.',
    ])
  })
})

describe('forgotPasswordSchema', () => {
  // Proves the email is checked and tidied.
  it('checks and tidies the email', () => {
    expect(forgotPasswordSchema.parse({ email: ' A@B.example ' })).toEqual({ email: 'a@b.example' })
    expect(messages(forgotPasswordSchema, { email: 'nope' })).toEqual([
      'Enter a valid email address.',
    ])
  })
})

describe('resetPasswordSchema', () => {
  // Proves a strong, confirmed password passes.
  it('accepts a 12-character password typed twice', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'new-password-2026',
        confirmPassword: 'new-password-2026',
      }).success,
    ).toBe(true)
  })

  // SECURITY: proves teachers need at least 12 characters (D68), not the students' 8.
  it('asks teachers for 12 characters', () => {
    expect(
      messages(resetPasswordSchema, { password: 'abcdefgh123', confirmPassword: 'abcdefgh123' }),
    ).toEqual(['Use at least 12 characters.'])
  })

  // Proves a mismatch is reported on the confirmation field.
  it('reports a mismatch on the confirmation', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'new-password-2026',
      confirmPassword: 'new-password-2027',
    })
    expect(result.error?.issues[0]).toMatchObject({
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    })
  })
})
