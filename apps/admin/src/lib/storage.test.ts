/**
 * Tests for clearing the admin console's stored data.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { ADMIN_STORAGE_PREFIX, clearAdminStorage } from './storage'

describe('clearAdminStorage', () => {
  // Proves only the console's own keys are removed, so another CoNote app on the same address
  // keeps its data.
  it("removes the console's keys and nothing else", () => {
    window.localStorage.setItem(`${ADMIN_STORAGE_PREFIX}session`, 'x')
    window.localStorage.setItem(`${ADMIN_STORAGE_PREFIX}filters`, 'y')
    window.localStorage.setItem('conote:session', 'student')
    clearAdminStorage(window.localStorage)
    expect(window.localStorage.length).toBe(1)
    expect(window.localStorage.getItem('conote:session')).toBe('student')
  })
})
