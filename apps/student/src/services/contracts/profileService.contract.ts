/**
 * The contract every ProfileService must meet (FR-SET-1, FR-SET-3). The mock runs it today; the
 * Supabase implementation runs the same file against a real database in CI
 * (ENGINEERING_STANDARDS.md 2.5). Each test works on the profile of the signed-in student.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The interfaces under test.
import type { Services } from '../types'

/** What an implementation's test file passes in. */
interface ProfileContractOptions {
  /** Builds a fresh profile service for a signed-in student. */
  create: () => Pick<Services, 'profile'>
  /** False when the implementation cannot store pictures yet; uploads must then be refused. */
  supportsAvatar: boolean
}

/** A picture file of `bytes` bytes and `type`. */
function picture(type: string, bytes = 10) {
  return new File([new Uint8Array(bytes)], 'me', { type })
}

/** Behaviour every implementation of the profile service shares. */
export function runProfileServiceContract(
  name: string,
  { create, supportsAvatar }: ProfileContractOptions,
) {
  describe(`Profile service contract: ${name}`, () => {
    // Proves the profile is the signed-in student's, with settings for all three alert kinds.
    it('reads the signed-in student', async () => {
      const me = await create().profile.getMe()

      expect(me.id).not.toBe('')
      expect(me.role).toBe('student')
      expect(me.email).toContain('@')
      expect(me.fullName).not.toBe('')
      for (const kind of ['summaryPublished', 'classReminders', 'announcements'] as const) {
        expect(me.notificationPrefs[kind]).toEqual({
          inApp: expect.any(Boolean) as boolean,
          email: expect.any(Boolean) as boolean,
        })
      }
    })

    // Proves only the fields given change, and what was saved is read back.
    it('changes only the fields it is given', async () => {
      // Arrange.
      const { profile } = create()
      const before = await profile.getMe()

      // Act.
      const after = await profile.updateMe({
        department: ' Computer Science ',
        level: '300',
        phone: '+234 801 234 5678',
      })

      // Assert: the name and email were not touched; the rest is trimmed and kept.
      expect(after).toMatchObject({
        id: before.id,
        fullName: before.fullName,
        email: before.email,
        department: 'Computer Science',
        level: '300',
        phone: '+234 801 234 5678',
      })
      await expect(profile.getMe()).resolves.toEqual(after)
    })

    // Proves a new name is saved trimmed.
    it('saves a new name', async () => {
      const { profile } = create()

      const after = await profile.updateMe({ fullName: '  Ada Lovelace ' })

      expect(after.fullName).toBe('Ada Lovelace')
      await expect(profile.getMe()).resolves.toMatchObject({ fullName: 'Ada Lovelace' })
    })

    // Proves an optional field can be cleared.
    it('clears an optional field', async () => {
      const { profile } = create()
      await profile.updateMe({ department: 'Physics', phone: '+234 801 234 5678' })

      const after = await profile.updateMe({ department: '', phone: '' })

      expect(after.department ?? '').toBe('')
      expect(after.phone ?? '').toBe('')
    })

    // Proves notification settings are saved as a whole and read back.
    it('saves notification settings', async () => {
      // Arrange.
      const { profile } = create()
      const prefs = {
        summaryPublished: { inApp: false, email: false },
        classReminders: { inApp: true, email: true },
        announcements: { inApp: false, email: true },
      }

      // Act.
      const after = await profile.updateMe({ notificationPrefs: prefs })

      // Assert.
      expect(after.notificationPrefs).toEqual(prefs)
      await expect(profile.getMe()).resolves.toMatchObject({ notificationPrefs: prefs })
    })

    // SECURITY: proves the profile rules are applied by the service itself, so skipping the form
    // does not skip them.
    it.each([
      ['an empty name', { fullName: '   ' }],
      ['a name that is too long', { fullName: 'n'.repeat(81) }],
      ['a department that is too long', { department: 'd'.repeat(81) }],
      ['a level that is too long', { level: 'l'.repeat(41) }],
      ['a phone number with letters', { phone: 'call me maybe' }],
      ['settings of the wrong shape', { notificationPrefs: { summaryPublished: true } }],
    ])('rejects %s as a validation error', async (_label, changes) => {
      const attempt = create().profile.updateMe(
        changes as Parameters<Services['profile']['updateMe']>[0],
      )

      await expect(attempt).rejects.toMatchObject({ kind: 'validation' })
    })

    // SECURITY: proves a picture address that could run code or track viewers is refused.
    it.each([
      'javascript:alert(1)',
      'http://tracker.example/p.png',
      'data:image/svg+xml;base64,AAAA',
    ])('refuses the picture address %s', async (avatarUrl) => {
      await expect(create().profile.updateMe({ avatarUrl })).rejects.toMatchObject({
        kind: 'validation',
      })
    })

    // SECURITY: proves only a JPG or PNG of 2 MB or less is accepted as a picture.
    it('refuses a picture of the wrong type or size', async () => {
      const { profile } = create()

      await expect(profile.uploadAvatar(picture('image/svg+xml'))).rejects.toMatchObject({
        kind: 'validation',
      })
      await expect(
        profile.uploadAvatar(picture('image/png', 2 * 1024 * 1024 + 1)),
      ).rejects.toMatchObject({ kind: 'validation' })
    })

    // Proves a good picture is stored where supported, and refused clearly where it is not.
    it(
      supportsAvatar ? 'stores a picture and returns its address' : 'refuses pictures for now',
      async () => {
        const upload = create().profile.uploadAvatar(picture('image/png'))

        if (supportsAvatar) {
          await expect(upload).resolves.toMatch(/^(data:image\/png;base64,|https:\/\/)/)
        } else {
          await expect(upload).rejects.toMatchObject({
            message: expect.stringContaining('picture') as string,
          })
        }
      },
    )
  })
}
