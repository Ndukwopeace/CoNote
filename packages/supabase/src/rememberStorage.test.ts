/**
 * Tests for the storage adapter behind "Remember me". A session that was not remembered must
 * never be written to long-lived storage (ENGINEERING_STANDARDS.md 6.4).
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// The function under test.
import { createRememberStorage } from './rememberStorage'

// A made-up key, like the one Supabase uses for its stored session.
const KEY = 'sb-test-auth-token'

describe('createRememberStorage', () => {
  beforeEach(() => {
    // Each test starts with empty storage.
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  /** A fresh adapter over the test page's storage areas. */
  function create() {
    return createRememberStorage({
      local: window.localStorage,
      session: window.sessionStorage,
      flagKey: 'remember-flag',
    })
  }

  // SECURITY: proves a session that is not remembered stays out of localStorage, so it ends with
  // the browser session and is not left on a shared computer.
  it('keeps a session in sessionStorage unless remembered', () => {
    const { storage, setRemember } = create()
    setRemember(false)
    storage.setItem(KEY, 'token')
    expect(window.sessionStorage.getItem(KEY)).toBe('token')
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(storage.getItem(KEY)).toBe('token')
  })

  // Proves "Remember me" keeps the session across browser restarts.
  it('keeps a remembered session in localStorage', () => {
    const { storage, setRemember } = create()
    setRemember(true)
    storage.setItem(KEY, 'token')
    expect(window.localStorage.getItem(KEY)).toBe('token')
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  // Proves a token refresh lands in the same place as the session it refreshes, even after a
  // page reload when the choice is no longer in memory.
  it('writes a refreshed token where the session already lives', () => {
    window.localStorage.setItem(KEY, 'old')
    const { storage } = create()
    storage.setItem(KEY, 'new')
    expect(window.localStorage.getItem(KEY)).toBe('new')
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  // Proves changing the choice moves the session instead of leaving a copy behind.
  it('leaves no copy in the other storage', () => {
    window.sessionStorage.setItem(KEY, 'stale')
    const { storage, setRemember } = create()
    setRemember(true)
    storage.removeItem(KEY)
    storage.setItem(KEY, 'token')
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  // SECURITY: proves sign-out clears the session from both places.
  it('removes the session from both storage areas', () => {
    window.localStorage.setItem(KEY, 'a')
    window.sessionStorage.setItem(KEY, 'b')
    const { storage } = create()
    storage.removeItem(KEY)
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(storage.getItem(KEY)).toBeNull()
  })

  // Proves the choice itself survives a reload, so refreshed tokens keep following it.
  it('remembers the choice across adapters', () => {
    create().setRemember(true)
    expect(window.localStorage.getItem('remember-flag')).toBe('1')
    create().setRemember(false)
    expect(window.localStorage.getItem('remember-flag')).toBeNull()
  })
})
