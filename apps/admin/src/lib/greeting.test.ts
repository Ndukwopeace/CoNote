/**
 * Tests for the dashboard greeting (admin REQUIREMENTS section 10).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { firstName, greeting } from './greeting'

/** A local time today at `hour`:`minute`. */
function at(hour: number, minute = 0) {
  return new Date(2026, 9, 8, hour, minute)
}

describe('greeting', () => {
  // Proves each part of the day gets its own words, with the boundaries where people expect them.
  it.each([
    [at(5), 'Good morning'],
    [at(11, 59), 'Good morning'],
    [at(12), 'Good afternoon'],
    [at(17, 59), 'Good afternoon'],
    [at(18), 'Good evening'],
    [at(23, 59), 'Good evening'],
    [at(0), 'Good evening'],
    [at(4, 59), 'Good evening'],
  ])('greets at %s with "%s"', (time, expected) => {
    expect(greeting(time)).toBe(expected)
  })
})

describe('firstName', () => {
  // Proves the first word of the name is used.
  it('takes the first word', () => {
    expect(firstName('Amara Okafor')).toBe('Amara')
  })

  // Proves stray spaces don't produce an empty name.
  it('ignores surrounding spaces', () => {
    expect(firstName('  Amara   Okafor ')).toBe('Amara')
  })

  // Proves an empty name gives an empty string rather than failing.
  it('returns an empty string for an empty name', () => {
    expect(firstName('   ')).toBe('')
  })
})
