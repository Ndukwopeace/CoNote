/**
 * Tests for the sign-in form's rules.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { signInSchema } from './authSchemas'

describe('signInSchema', () => {
  // Proves good input passes, with the email tidied.
  it('accepts an email and password, trimming the email', () => {
    expect(signInSchema.parse({ email: ' Admin@CoNote.example ', password: 'x' })).toEqual({
      email: 'admin@conote.example',
      password: 'x',
    })
  })

  // Proves the messages a person sees for empty or wrong fields.
  it('explains what is missing', () => {
    const result = signInSchema.safeParse({ email: 'not-an-email', password: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Enter a valid email address.',
      'Enter your password.',
    ])
  })
})
