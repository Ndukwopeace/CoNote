/**
 * Tests for reading the year out of a programme's code (D115).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { programmeYear, yearLabel } from './programmeYear'

describe('programmeYear', () => {
  // Proves the plain shape the timetable import writes: the course of study, then the year.
  it('reads the year from a code like SWE-Y3', () => {
    expect(programmeYear('SWE-Y3')).toBe(3)
    expect(programmeYear('BMS-Y1')).toBe(1)
  })

  // Proves a track after the year does not hide it.
  it('reads the year when a track follows', () => {
    expect(programmeYear('CSN-Y3-CSDPE')).toBe(3)
    expect(programmeYear('SWE-Y3-AAEM')).toBe(3)
  })

  // Proves letter case does not matter, as codes are unique in any case.
  it('ignores letter case', () => {
    expect(programmeYear('swe-y2')).toBe(2)
  })

  // Proves a two-digit year is read whole, not as its first digit.
  it('reads more than one digit', () => {
    expect(programmeYear('MED-Y10')).toBe(10)
  })

  // Proves a code without a year is left without one, so the programme is not put in a wrong year.
  it('gives null when the code has no year', () => {
    expect(programmeYear('LAW')).toBeNull()
    expect(programmeYear('Y3')).toBeNull()
    expect(programmeYear('SWE-Y3A')).toBeNull()
    expect(programmeYear('SWE-Y0')).toBeNull()
    expect(programmeYear('')).toBeNull()
  })
})

describe('yearLabel', () => {
  // Proves the words on the year buttons.
  it('says "Year 3"', () => {
    expect(yearLabel(3)).toBe('Year 3')
  })
})
