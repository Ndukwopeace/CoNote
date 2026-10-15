/**
 * Tests for remembering a sign-up that is waiting for its email code. A student leaves the app to
 * read the email, and a phone may reload the page on their return; the code screen should still
 * be there.
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The helpers under test.
import { clearPendingSignup, readPendingSignup, rememberPendingSignup } from './pendingSignup'
// Sign-out's clean-up, to prove it removes this too.
import { clearUserData } from './storage'

/** A fixed moment, so the tests do not depend on the clock. */
const NOW = new Date('2026-10-15T10:00:00.000Z')
/** `minutes` minutes after NOW. */
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

beforeEach(() => {
  window.localStorage.clear()
})

describe('pending sign-up', () => {
  // Proves the address comes back while the code is still good.
  it('remembers the address for a while', () => {
    rememberPendingSignup('ada@example.com', NOW)
    expect(readPendingSignup(later(30))).toBe('ada@example.com')
  })

  // Proves an old one is ignored and removed: the code has expired, so the form is the right screen.
  it('forgets it after the code has expired', () => {
    rememberPendingSignup('ada@example.com', NOW)
    expect(readPendingSignup(later(61))).toBeNull()
    expect(window.localStorage).toHaveLength(0)
  })

  // Proves nothing remembered reads as nothing, and clearing is safe to repeat.
  it('reads nothing when nothing was remembered', () => {
    expect(readPendingSignup(NOW)).toBeNull()
    clearPendingSignup()
    clearPendingSignup()
  })

  // SECURITY: proves a damaged or made-up entry is ignored, never trusted: storage can be edited by
  // anything running on the page.
  it.each([['not json'], ['{"email":42,"at":"x"}'], ['{"email":"a@b.co"}'], ['null']])(
    'ignores the stored value %j',
    (value) => {
      window.localStorage.setItem('conote:pending-signup', value)
      expect(readPendingSignup(NOW)).toBeNull()
    },
  )

  // SECURITY: proves signing out on a shared computer leaves no address behind.
  it('is removed by the sign-out clean-up', () => {
    rememberPendingSignup('ada@example.com', NOW)
    clearUserData([window.localStorage])
    expect(readPendingSignup(NOW)).toBeNull()
  })

  // Proves storage that refuses writes (a private window) never breaks the sign-up.
  it('survives storage that throws', () => {
    const refuse = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    try {
      expect(() => {
        rememberPendingSignup('ada@example.com', NOW)
      }).not.toThrow()
    } finally {
      refuse.mockRestore()
    }
  })
})
