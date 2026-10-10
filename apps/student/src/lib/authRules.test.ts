/**
 * Tests for the checks every auth service runs before it talks to a backend. They are enforced
 * here as well as in the forms, so a request that skips the form cannot get around them.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test, and the rules it applies.
import { assertEmail, assertRule } from './authRules'
import { newPasswordSchema } from './authSchemas'

describe('assertEmail', () => {
  // Proves a well-formed address passes.
  it('accepts a valid email', () => {
    expect(() => {
      assertEmail('ada@example.com')
    }).not.toThrow()
  })

  // Proves a malformed address becomes a validation error with a message the form can show.
  it('rejects a malformed email', () => {
    expect(() => {
      assertEmail('not-an-email')
    }).toThrow(
      expect.objectContaining({ kind: 'validation', message: 'Enter a valid email address.' }),
    )
  })
})

describe('assertRule', () => {
  // Proves a value that meets the rule passes.
  it('accepts a value that meets the rule', () => {
    expect(() => {
      assertRule(newPasswordSchema, 'password1')
    }).not.toThrow()
  })

  // Proves the first broken rule's message is the one the student sees.
  it('throws the first broken rule as a validation error', () => {
    expect(() => {
      assertRule(newPasswordSchema, 'password')
    }).toThrow(
      expect.objectContaining({ kind: 'validation', message: 'Include at least one number.' }),
    )
  })
})
