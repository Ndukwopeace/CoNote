/**
 * Tests for the invite and edit forms' rules (admin REQUIREMENTS section 11).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { editUserSchema, inviteUserSchema } from './userSchemas'

/** The first message the schema gives for `values`, or undefined when they pass. */
function firstError(schema: typeof inviteUserSchema | typeof editUserSchema, values: unknown) {
  const result = schema.safeParse(values)
  return result.success ? undefined : result.error.issues[0]?.message
}

describe('inviteUserSchema', () => {
  // A complete, valid invitation.
  const valid = {
    role: 'student',
    fullName: 'Ada Obi',
    email: 'ada@conote.example',
    department: 'Computer Science',
  }

  // Proves a valid invitation passes, with the email trimmed and in lower case.
  it('accepts a valid invitation and tidies the email', () => {
    expect(inviteUserSchema.parse({ ...valid, email: '  Ada@Conote.Example ' }).email).toBe(
      'ada@conote.example',
    )
  })

  // Proves each field's message.
  it.each([
    [{ fullName: '  ' }, 'Enter a name.'],
    [{ email: 'not-an-email' }, 'Enter a valid email address.'],
    [{ department: '' }, 'Choose a department.'],
  ])('refuses %j', (change, message) => {
    expect(firstError(inviteUserSchema, { ...valid, ...change })).toBe(message)
  })

  // Proves administrators need no department.
  it('lets administrators be invited without a department', () => {
    expect(
      firstError(inviteUserSchema, { ...valid, role: 'admin', department: '' }),
    ).toBeUndefined()
  })
})

describe('editUserSchema', () => {
  // A complete, valid edit.
  const valid = {
    fullName: 'Ada Obi',
    department: 'Computer Science',
    level: '200 Level',
    phone: '+234 803 555 1234',
    studentNumber: 'U2023/5010',
    staffNumber: '',
  }

  // Proves blank optional fields become null, so they are stored as empty.
  it('turns blank optional fields into null', () => {
    expect(editUserSchema.parse({ ...valid, phone: ' ', staffNumber: '' })).toMatchObject({
      phone: null,
      staffNumber: null,
    })
  })

  // Proves null (from the service's input) is accepted for optional fields, like a blank.
  it('accepts null for optional fields', () => {
    expect(editUserSchema.parse({ ...valid, phone: null, level: null })).toMatchObject({
      phone: null,
      level: null,
    })
  })

  // Proves each field's message.
  it.each([
    [{ fullName: '' }, 'Enter a name.'],
    [{ phone: 'call me' }, 'Enter a phone number using digits, spaces, + and -.'],
  ])('refuses %j', (change, message) => {
    expect(firstError(editUserSchema, { ...valid, ...change })).toBe(message)
  })
})
