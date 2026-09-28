import { describe, expect, it } from 'vitest'

import { firstName, initials } from './initials'

describe('initials', () => {
  it.each([
    ['Victory Okafor', 'VO'],
    ['Ada', 'A'],
    ['  mary  jane  watson ', 'MW'],
    ['', '?'],
  ])('turns "%s" into "%s"', (name, expected) => {
    expect(initials(name)).toBe(expected)
  })
})

describe('firstName', () => {
  it('returns the first word of a full name', () => {
    expect(firstName('Victory Okafor')).toBe('Victory')
  })

  it('returns an empty string for a blank name', () => {
    expect(firstName('   ')).toBe('')
  })
})
