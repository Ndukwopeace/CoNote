/**
 * Tests for the portal's date wording.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { basedOnText, classesText, formatDate, notesText, waitedText } from './format'

describe('formatDate', () => {
  // Proves a date reads as day, month and year, and a missing one reads as the fallback.
  it('formats a date and falls back when there is none', () => {
    // The expected text is built the same way, because Node's month names vary ("Sept").
    const iso = '2026-10-08T12:00:00.000Z'
    expect(formatDate(iso)).toBe(
      new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    )
    expect(formatDate(null)).toBe('—')
    expect(formatDate(null, 'Never')).toBe('Never')
  })
})

describe('waitedText', () => {
  /** A fixed "now". */
  const now = new Date('2026-10-12T10:00:00.000Z')

  // Proves the wording by whole days, with singular and plural.
  it.each([
    ['2026-10-12T04:00:00.000Z', 'Waiting less than a day'],
    ['2026-10-11T09:00:00.000Z', 'Waiting 1 day'],
    ['2026-10-07T09:00:00.000Z', 'Waiting 5 days'],
  ])('says how long since %s', (since, text) => {
    expect(waitedText(since, now)).toBe(text)
  })

  // Proves a time slightly ahead of the clock never reads as negative.
  it('never goes negative', () => {
    expect(waitedText('2026-10-12T10:05:00.000Z', now)).toBe('Waiting less than a day')
  })
})

describe('counts', () => {
  // Proves the review header's wording, with singular and plural, and that it states counts only.
  it('words the notes behind a summary', () => {
    expect(basedOnText(18, 14)).toBe('Based on 18 notes from 14 students')
    expect(basedOnText(1, 1)).toBe('Based on 1 note from 1 student')
  })

  // Proves singular and plural for classes and notes.
  it('words classes and notes', () => {
    expect(classesText(1)).toBe('1 class')
    expect(classesText(7)).toBe('7 classes')
    expect(notesText(1)).toBe('1 note')
    expect(notesText(0)).toBe('0 notes')
  })
})
