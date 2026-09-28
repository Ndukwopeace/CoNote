/**
 * Tests for storage naming and the sign-out clean-up.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { clearUserData, storageKey } from './storage'

describe('storageKey', () => {
  // Proves keys are namespaced, which is what lets clean-up find them.
  it('prefixes every key with the app namespace', () => {
    expect(storageKey('draft', 'class-1')).toBe('conote:draft:class-1')
  })
})

describe('clearUserData', () => {
  // SECURITY: proves nothing of the student's is left on a shared computer after sign-out.
  it('removes session, draft and AI keys from every store', () => {
    // Arrange: student data in both storage areas.
    window.localStorage.setItem('conote:session', 'x')
    window.localStorage.setItem('conote:draft:class-1', 'x')
    window.sessionStorage.setItem('conote:session', 'x')
    window.sessionStorage.setItem('conote:ai:conversation', 'x')

    // Act: clean up.
    clearUserData([window.localStorage, window.sessionStorage])

    // Assert: both are empty.
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  // Proves demo data survives, since in demo mode it plays the part of the server.
  it('keeps mock demo data, which stands in for the server', () => {
    // Arrange: demo data.
    window.localStorage.setItem('conote:mock:notes', '[]')

    // Act.
    clearUserData([window.localStorage])

    // Assert: still there.
    expect(window.localStorage.getItem('conote:mock:notes')).toBe('[]')
  })

  // Proves CoNote only deletes its own keys, never another site's or app's data.
  it('leaves keys that belong to other apps alone', () => {
    // Arrange: a key without CoNote's prefix.
    window.localStorage.setItem('other-app:setting', 'x')

    // Act.
    clearUserData([window.localStorage])

    // Assert: untouched.
    expect(window.localStorage.getItem('other-app:setting')).toBe('x')
  })
})
