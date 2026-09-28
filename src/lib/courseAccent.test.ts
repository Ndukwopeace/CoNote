/**
 * Tests for picking a course's icon colour.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test.
import { courseAccent } from './courseAccent'

describe('courseAccent', () => {
  // Proves a course keeps its colour across renders and visits.
  it('gives the same course the same accent every time', () => {
    // Assert.
    expect(courseAccent('swe-311')).toBe(courseAccent('swe-311'))
  })

  // Proves only the four defined accents are used.
  it('returns an accent between 1 and 4', () => {
    // Act: many different IDs.
    const accents = Array.from({ length: 50 }, (_, i) => courseAccent(`course-${String(i)}`))

    // Assert: always in range, and more than one colour in use.
    expect(accents.every((a) => a >= 1 && a <= 4)).toBe(true)
    expect(new Set(accents).size).toBeGreaterThan(1)
  })

  // Proves an empty ID still gets a valid accent.
  it('handles an empty ID', () => {
    // Assert.
    expect(courseAccent('')).toBeGreaterThanOrEqual(1)
  })
})
