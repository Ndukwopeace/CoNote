/**
 * Tests for the installable-app rules (REQUIREMENTS.md FR-PWA-5 to FR-PWA-7).
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The rules under test.
import {
  UPDATE_CHECK_INTERVAL_MS,
  clearRuntimeCaches,
  installOption,
  isIosDevice,
  shouldCheckForUpdate,
  shouldShowUpdatePrompt,
} from './pwa'

describe('UPDATE_CHECK_INTERVAL_MS', () => {
  // Proves the agreed limit (FR-PWA-5, D37): at most one check every 15 minutes.
  it('is 15 minutes', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(15 * 60 * 1000)
  })
})

describe('shouldCheckForUpdate', () => {
  // A fixed "now" for readable arithmetic.
  const now = 10 * UPDATE_CHECK_INTERVAL_MS

  // Proves the first focus always checks.
  it('checks when it has never checked', () => {
    expect(shouldCheckForUpdate(null, now)).toBe(true)
  })

  // Proves checks are limited to one per interval (FR-PWA-5).
  it('waits a full interval between checks', () => {
    // A minute short of the interval: no.
    expect(shouldCheckForUpdate(now - UPDATE_CHECK_INTERVAL_MS + 60_000, now)).toBe(false)
    // Exactly the interval: yes.
    expect(shouldCheckForUpdate(now - UPDATE_CHECK_INTERVAL_MS, now)).toBe(true)
  })

  // Proves a clock that moved backwards (time zone or manual change) doesn't block checks forever.
  it('checks when the last check appears to be in the future', () => {
    expect(shouldCheckForUpdate(now + 60_000, now)).toBe(true)
  })
})

describe('shouldShowUpdatePrompt', () => {
  // Proves the rule table from FR-PWA-5: [update ready, unsaved changes, show?].
  it.each([
    [false, false, false],
    [false, true, false],
    [true, false, true],
    // The key rule: an update never interrupts unsaved writing.
    [true, true, false],
  ])('update ready %s, unsaved %s → %s', (updateReady, hasUnsavedChanges, expected) => {
    expect(shouldShowUpdatePrompt({ updateReady, hasUnsavedChanges })).toBe(expected)
  })
})

describe('installOption', () => {
  // Proves the rule table from FR-PWA-6: [installed, can prompt, iOS, option].
  it.each([
    // Already installed: nothing to offer, whatever else is true.
    [true, true, false, 'hidden'],
    [true, false, true, 'hidden'],
    // The browser offers a prompt: use it.
    [false, true, false, 'prompt'],
    // iOS has no prompt: show the Share → Add to Home Screen instructions.
    [false, false, true, 'ios'],
    // Neither: the browser can't install, so the item is hidden.
    [false, false, false, 'hidden'],
  ] as const)(
    'installed %s, prompt %s, iOS %s → %s',
    (isStandalone, canPrompt, isIos, expected) => {
      expect(installOption({ isStandalone, canPrompt, isIos })).toBe(expected)
    },
  )
})

describe('isIosDevice', () => {
  // Proves iPhones and iPads are recognised, including iPads that report a desktop Mac.
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 5, true],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 5, true],
    // iPadOS Safari asks for desktop sites and says "Macintosh"; touch points give it away.
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5, true],
    // A real Mac has no touch screen.
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0, false],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 Chrome/140.0', 5, false],
  ])('%s with %i touch points → %s', (userAgent, maxTouchPoints, expected) => {
    expect(isIosDevice(userAgent, maxTouchPoints)).toBe(expected)
  })
})

describe('clearRuntimeCaches', () => {
  // SECURITY: proves sign-out deletes every cache that may hold student data (FR-PWA-7), and
  // keeps the app shell, which holds none, so the app still opens offline.
  it('deletes CoNote runtime caches and keeps the precached app shell', async () => {
    // Arrange: a fake cache store with one of each kind.
    const deleted: string[] = []
    const caches = {
      keys: () =>
        Promise.resolve([
          'workbox-precache-v2-https://conote.app/',
          'conote-runtime-notes',
          'conote-runtime-summaries',
        ]),
      delete: vi.fn((name: string) => {
        deleted.push(name)
        return Promise.resolve(true)
      }),
    }

    // Act.
    await clearRuntimeCaches(caches)

    // Assert: both runtime caches gone, the precache untouched.
    expect(deleted.sort()).toEqual(['conote-runtime-notes', 'conote-runtime-summaries'])
  })

  // Proves browsers without the Cache API (or with it blocked) don't break sign-out.
  it('does nothing when the Cache API is unavailable', async () => {
    await expect(clearRuntimeCaches(undefined)).resolves.toBeUndefined()
  })
})
