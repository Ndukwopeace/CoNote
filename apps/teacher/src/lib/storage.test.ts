/**
 * Tests for clearing the teacher portal's stored data.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { TEACHER_STORAGE_PREFIX, clearTeacherStorage } from './storage'

describe('clearTeacherStorage', () => {
  // Proves only the portal's own keys are removed, so another CoNote app on the same address
  // keeps its data.
  it("removes the portal's keys and nothing else", () => {
    window.localStorage.setItem(`${TEACHER_STORAGE_PREFIX}session`, 'x')
    window.localStorage.setItem(`${TEACHER_STORAGE_PREFIX}filters`, 'y')
    window.localStorage.setItem('conote:session', 'student')
    clearTeacherStorage(window.localStorage)
    expect(window.localStorage).toHaveLength(1)
    expect(window.localStorage.getItem('conote:session')).toBe('student')
  })
})
