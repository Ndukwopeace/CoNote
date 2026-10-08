/**
 * Tests for the console's date wording.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { formatDate } from './format'

describe('formatDate', () => {
  // Proves dates read as day, short month and year, on the local calendar.
  it('formats a date', () => {
    expect(formatDate(new Date(2026, 9, 8, 23, 30).toISOString())).toBe('8 Oct 2026')
  })

  // Proves a missing date reads as the given fallback.
  it('uses the fallback for no date', () => {
    expect(formatDate(null, 'Never')).toBe('Never')
  })
})
