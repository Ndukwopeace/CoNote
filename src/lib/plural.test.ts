/**
 * Tests for counted nouns ("1 note", "2 notes").
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test.
import { countOf } from './plural'

describe('countOf', () => {
  // Proves singular and regular plural.
  it('uses the singular for one and adds "s" otherwise', () => {
    // Assert.
    expect(countOf(1, 'note')).toBe('1 note')
    expect(countOf(0, 'note')).toBe('0 notes')
    expect(countOf(48, 'student')).toBe('48 students')
  })

  // Proves an irregular plural can be given.
  it('uses a given plural', () => {
    // Assert.
    expect(countOf(4, 'class', 'classes')).toBe('4 classes')
    expect(countOf(1, 'class', 'classes')).toBe('1 class')
  })
})
