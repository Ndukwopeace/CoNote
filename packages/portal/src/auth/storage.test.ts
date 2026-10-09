/**
 * Tests for clearing a portal's stored data.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { clearPrefixedStorage } from './storage'

describe('clearPrefixedStorage', () => {
  // Proves only keys with the prefix are removed, so another CoNote app on the same address
  // keeps its data.
  it('removes the keys with the prefix and nothing else', () => {
    window.localStorage.setItem('conote-x:session', 'x')
    window.localStorage.setItem('conote-x:filters', 'y')
    window.localStorage.setItem('conote:session', 'student')
    clearPrefixedStorage(window.localStorage, 'conote-x:')
    expect(window.localStorage).toHaveLength(1)
    expect(window.localStorage.getItem('conote:session')).toBe('student')
  })
})
