/**
 * Tests for the name helpers.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { firstName, initials } from './initials'

describe('initials', () => {
  // Proves the avatar initials for normal, single-word, messy and blank names.
  it.each([
    // First and last word.
    ['Victory Okafor', 'VO'],
    // One word gives one letter.
    ['Ada', 'A'],
    // Extra spaces are ignored; middle names are skipped.
    ['  mary  jane  watson ', 'MW'],
    // Blank shows "?" so the avatar is never empty.
    ['', '?'],
  ])('turns "%s" into "%s"', (name, expected) => {
    expect(initials(name)).toBe(expected)
  })
})

describe('firstName', () => {
  // Proves the dashboard greeting uses the first name.
  it('returns the first word of a full name', () => {
    expect(firstName('Victory Okafor')).toBe('Victory')
  })

  // Proves a blank name doesn't crash the greeting.
  it('returns an empty string for a blank name', () => {
    expect(firstName('   ')).toBe('')
  })
})
