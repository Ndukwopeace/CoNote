/**
 * Tests for reading emails and student numbers from pasted text or a CSV file, for bulk
 * enrolment (admin REQUIREMENTS section 12).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { parseIdentifiers } from './identifiers'

describe('parseIdentifiers', () => {
  // Proves lines, commas and semicolons all separate values, and blanks are dropped.
  it('splits on lines, commas and semicolons', () => {
    expect(parseIdentifiers('a@x.example, b@x.example\n\nU2023/5001;U2023/5002\r\n')).toEqual([
      'a@x.example',
      'b@x.example',
      'U2023/5001',
      'U2023/5002',
    ])
  })

  // Proves quotes from spreadsheet exports are removed and repeats are kept once.
  it('removes quotes and repeats', () => {
    expect(parseIdentifiers('"a@x.example"\na@x.example\n\'U2023/5001\'')).toEqual([
      'a@x.example',
      'U2023/5001',
    ])
  })

  // Proves a header row from a spreadsheet is skipped.
  it('skips a header row', () => {
    expect(parseIdentifiers('email\na@x.example')).toEqual(['a@x.example'])
    expect(parseIdentifiers('Student number\nU2023/5001')).toEqual(['U2023/5001'])
  })

  // Proves a very large paste is capped, so the preview stays quick.
  it('reads at most 500 values', () => {
    const many = Array.from({ length: 600 }, (_, n) => `s${n}@x.example`).join('\n')
    expect(parseIdentifiers(many)).toHaveLength(500)
  })
})
