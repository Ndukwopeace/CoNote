/**
 * Tests for the demo profile service (FR-SET-1, FR-SET-3) and the demo reset (FR-SET-5).
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// Storage key helpers.
import { MOCK_DATA_PREFIX, storageKey } from '@/lib/storage'
// Factories.
import { makeSession } from '@/test/factories'

// The units under test, and the demo auth they sit on.
import { createMockAuthService } from './mockAuthService'
import { createMockProfileService, resetDemoData } from './mockProfileService'

/** A signed-in demo auth service and a profile service over it. */
function createServices() {
  // Signed in as Victory.
  window.sessionStorage.setItem(
    storageKey('session'),
    JSON.stringify(makeSession({ id: 'student-1' })),
  )
  const auth = createMockAuthService({
    localStore: window.localStorage,
    sessionStore: window.sessionStorage,
    latencyMs: 0,
  })
  const profile = createMockProfileService({ auth, store: window.localStorage, latencyMs: 0 })
  return { auth, profile }
}

// Each test starts empty.
beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('mock profile service', () => {
  // Proves the profile starts from the signed-in identity, with default notification settings.
  it('reads the signed-in student', async () => {
    // Act.
    const me = await createServices().profile.getMe()

    // Assert.
    expect(me).toMatchObject({
      id: 'student-1',
      fullName: 'Victory Okafor',
      email: 'victory@example.com',
      role: 'student',
    })
    expect(me.notificationPrefs.summaryPublished).toEqual({ inApp: true, email: true })
  })

  // Proves changes are saved, kept across a reload, and the new name reaches the session.
  it('updates the profile and the displayed name', async () => {
    // Arrange.
    const { auth, profile } = createServices()
    const seen: (string | undefined)[] = []
    auth.onAuthChange((session) => seen.push(session?.user.fullName))

    // Act.
    await profile.updateMe({
      fullName: 'Victory A. Okafor',
      department: 'Computer Science',
      level: '300',
      phone: '',
    })

    // Assert: saved, reloaded, and announced.
    const again = await createServices().profile.getMe()
    expect(again).toMatchObject({
      fullName: 'Victory A. Okafor',
      department: 'Computer Science',
      level: '300',
    })
    expect(seen).toContain('Victory A. Okafor')
  })

  // Proves notification settings are saved (FR-SET-3).
  it('saves notification settings', async () => {
    // Arrange.
    const { profile } = createServices()
    const prefs = {
      summaryPublished: { inApp: true, email: false },
      classReminders: { inApp: false, email: false },
      announcements: { inApp: true, email: true },
    }

    // Act.
    await profile.updateMe({ notificationPrefs: prefs })

    // Assert.
    await expect(profile.getMe()).resolves.toMatchObject({ notificationPrefs: prefs })
  })

  // SECURITY: proves the service applies the profile rules itself.
  it('rejects an invalid profile', async () => {
    await expect(
      createServices().profile.updateMe({ fullName: 'A', phone: '' }),
    ).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  // SECURITY: proves only an image data address made by the upload can be saved as the picture.
  it.each([
    'javascript:alert(1)',
    'https://evil.example/x.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
  ])('refuses the picture address %j', async (avatarUrl) => {
    await expect(createServices().profile.updateMe({ avatarUrl })).rejects.toMatchObject({
      kind: 'validation',
    })
  })

  // Proves a PNG is accepted and returned as an image data address; others are refused.
  it('uploads a picture', async () => {
    // Arrange.
    const { profile } = createServices()

    // Act and assert.
    const url = await profile.uploadAvatar(
      new File([new Uint8Array(10)], 'me.png', { type: 'image/png' }),
    )
    expect(url).toMatch(/^data:image\/png;base64,/)
    await expect(
      profile.uploadAvatar(new File(['<svg/>'], 'me.svg', { type: 'image/svg+xml' })),
    ).rejects.toMatchObject({ kind: 'validation', message: 'Choose a JPG or PNG image.' })
  })

  // Proves signed-out calls are refused.
  it('refuses when nobody is signed in', async () => {
    // Arrange.
    const { profile } = createServices()
    window.sessionStorage.clear()

    // Assert.
    await expect(profile.getMe()).rejects.toMatchObject({ kind: 'unauthorized' })
  })
})

describe('resetDemoData', () => {
  // Proves the reset removes demo changes only, leaving the session.
  it('removes demo data and keeps the session', () => {
    // Arrange.
    window.localStorage.setItem(`${MOCK_DATA_PREFIX}notes`, '[]')
    window.localStorage.setItem(`${MOCK_DATA_PREFIX}profile`, '{}')
    window.localStorage.setItem(storageKey('remember'), '1')

    // Act.
    resetDemoData(window.localStorage)

    // Assert.
    expect(window.localStorage.getItem(`${MOCK_DATA_PREFIX}notes`)).toBeNull()
    expect(window.localStorage.getItem(`${MOCK_DATA_PREFIX}profile`)).toBeNull()
    expect(window.localStorage.getItem(storageKey('remember'))).toBe('1')
  })
})
