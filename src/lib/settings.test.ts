/**
 * Tests for the Settings rules: the password change form, profile fields, the avatar check and
 * the notes export (FR-SET-1, FR-SET-2, FR-SET-4).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Note factory.
import { makeNote } from '@/test/factories'

// The rules under test.
import { changePasswordSchema } from './authSchemas'
import { avatarProblem, MAX_AVATAR_BYTES } from './avatar'
import { notesExport } from './exportNotes'
import { profileSchema } from './profile'

/** A file of `size` bytes with a MIME type. */
function file(type: string, size = 1000) {
  return new File([new Uint8Array(size)], 'avatar', { type })
}

describe('changePasswordSchema', () => {
  // Proves a valid change passes.
  it('accepts a valid change', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'old',
        password: 'newpass12',
        confirmPassword: 'newpass12',
      }).success,
    ).toBe(true)
  })

  // Proves each rule and its message.
  it.each([
    [
      { currentPassword: '', password: 'newpass12', confirmPassword: 'newpass12' },
      'Enter your current password.',
    ],
    [{ currentPassword: 'old', password: 'short', confirmPassword: 'short' }, /at least 8/],
    [
      { currentPassword: 'old', password: 'newpass12', confirmPassword: 'other1234' },
      'Passwords do not match.',
    ],
  ])('rejects %j', (values, message) => {
    const result = changePasswordSchema.safeParse(values)
    expect(result.error?.issues[0]?.message).toMatch(message)
  })
})

describe('profileSchema', () => {
  // Proves a normal profile passes and is trimmed.
  it('accepts and trims a profile', () => {
    const result = profileSchema.safeParse({
      fullName: '  Victory Okafor ',
      department: 'Computer Science',
      level: '300',
      phone: '+234 801 234 5678',
    })
    expect(result.data?.fullName).toBe('Victory Okafor')
  })

  // Proves the optional fields may be blank.
  it('allows blank optional fields', () => {
    expect(
      profileSchema.safeParse({ fullName: 'Ada', department: '', level: '', phone: '' }).success,
    ).toBe(true)
  })

  // Proves the phone number check.
  it('rejects a phone number with letters', () => {
    const result = profileSchema.safeParse({
      fullName: 'Ada',
      department: '',
      level: '',
      phone: 'call me',
    })
    expect(result.error?.issues[0]?.message).toBe(
      'Enter a phone number using digits, spaces, + or -.',
    )
  })
})

describe('avatarProblem', () => {
  // Proves JPG and PNG under 2 MB are accepted (FR-SET-1).
  it.each(['image/jpeg', 'image/png'])('accepts %s', (type) => {
    expect(avatarProblem(file(type))).toBeNull()
  })

  // SECURITY: proves other types are refused; SVG in particular can carry scripts.
  it.each(['image/svg+xml', 'image/gif', 'text/html', ''])('refuses %j', (type) => {
    expect(avatarProblem(file(type))).toBe('Choose a JPG or PNG image.')
  })

  // Proves the 2 MB limit.
  it('refuses a file over 2 MB', () => {
    expect(avatarProblem(file('image/png', MAX_AVATAR_BYTES + 1))).toBe(
      'Choose an image of 2 MB or less.',
    )
  })
})

describe('notesExport', () => {
  // Proves the export is readable JSON holding the notes and when it was made (FR-SET-4).
  it('builds a JSON export of the notes', () => {
    // Act.
    const json = notesExport(
      [makeNote({ id: 'n1', title: 'One' })],
      new Date('2026-09-28T09:00:00Z'),
    )

    // Assert.
    const parsed = JSON.parse(json) as {
      exportedAt: string
      notes: { id: string; title: string }[]
    }
    expect(parsed.exportedAt).toBe('2026-09-28T09:00:00.000Z')
    expect(parsed.notes.map((n) => n.title)).toEqual(['One'])
    expect(json).toContain('\n  ')
  })
})
