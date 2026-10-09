/**
 * Tests for the course form's rules and the course code's tidy form (admin REQUIREMENTS
 * section 12).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { courseSchema, normalizeCourseCode } from './courseSchemas'

describe('normalizeCourseCode', () => {
  // Proves codes are stored one way, however they are typed.
  it.each([
    ['swe311', 'SWE 311'],
    ['  swe   311 ', 'SWE 311'],
    ['CSC 101L', 'CSC 101L'],
  ])('tidies %j to %j', (typed, tidy) => {
    expect(normalizeCourseCode(typed)).toBe(tidy)
  })
})

describe('courseSchema', () => {
  // A complete, valid course.
  const valid = {
    code: 'swe 311',
    title: 'Software Engineering',
    description: '',
    department: 'Software Engineering',
    status: 'ongoing',
    teacherId: 't1',
  }

  // Proves a valid course passes, tidied: the code in its standard form, blanks as null.
  it('accepts and tidies a valid course', () => {
    expect(courseSchema.parse({ ...valid, department: ' ', teacherId: '' })).toEqual({
      ...valid,
      code: 'SWE 311',
      department: null,
      teacherId: null,
    })
  })

  // Proves each field's message.
  it.each([
    [{ code: 'software' }, 'Enter a code like SWE 311.'],
    [{ title: ' ' }, 'Enter a title.'],
    [{ description: 'x'.repeat(1001) }, 'Use at most 1000 characters.'],
    [{ status: 'finished' }, 'Choose a status.'],
  ])('refuses %j', (change, message) => {
    const result = courseSchema.safeParse({ ...valid, ...change })
    expect(result.success ? undefined : result.error.issues[0]?.message).toBe(message)
  })
})
