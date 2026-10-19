/**
 * Tests for the words the import review uses for counts and weekly slots (D105).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { countOf, describeSlots } from './describe'

describe('countOf', () => {
  // Proves one takes the singular and everything else the plural, including none.
  it('uses the singular for one and the plural otherwise', () => {
    expect(countOf(1, 'course')).toBe('1 course')
    expect(countOf(0, 'course')).toBe('0 courses')
    expect(countOf(41, 'class', 'classes')).toBe('41 classes')
    expect(countOf(1, 'class', 'classes')).toBe('1 class')
  })
})

describe('describeSlots', () => {
  // Proves slots read as short day names with 24-hour times, in the order given.
  it('lists each slot with its day and times', () => {
    expect(
      describeSlots([
        { weekday: 1, start: '08:00', end: '12:00', title: 'x' },
        { weekday: 4, start: '13:00', end: '17:00', title: 'x' },
      ]),
    ).toBe('Mon 08:00–12:00, Thu 13:00–17:00')
  })

  // Proves a course with no slots says so rather than showing nothing.
  it('says when there are no slots', () => {
    expect(describeSlots([])).toBe('No weekly slot')
  })
})
