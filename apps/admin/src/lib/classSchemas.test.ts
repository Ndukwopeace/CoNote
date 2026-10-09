/**
 * Tests for the class form's rules (admin REQUIREMENTS section 13).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { classSchema } from './classSchemas'

/** A complete, valid class. */
const valid = {
  courseId: 'c1',
  title: '  Loops  ',
  date: '2026-10-20',
  startTime: '09:00',
  endTime: '10:30',
  description: '',
}

/** The first message for `values`, or null when they are valid. */
function firstMessage(values: unknown) {
  const result = classSchema.safeParse(values)
  return result.success ? null : (result.error.issues[0]?.message ?? null)
}

describe('classSchema', () => {
  // Proves a valid class is accepted and tidied.
  it('accepts a valid class', () => {
    expect(classSchema.parse(valid)).toMatchObject({ title: 'Loops', startTime: '09:00' })
  })

  // Proves each rule has its message.
  it.each([
    [{ courseId: ' ' }, 'Choose a course.'],
    [{ title: ' ' }, 'Enter a title.'],
    [{ title: 'x'.repeat(151) }, 'Use at most 150 characters.'],
    [{ date: '' }, 'Enter a date.'],
    [{ date: '2026-02-31' }, 'Enter a date.'],
    [{ startTime: '' }, 'Enter a start time.'],
    [{ startTime: '25:00' }, 'Enter a start time.'],
    [{ endTime: '9' }, 'Enter an end time.'],
    [{ description: 'x'.repeat(1001) }, 'Use at most 1000 characters.'],
  ])('rejects %j', (change, message) => {
    expect(firstMessage({ ...valid, ...change })).toBe(message)
  })

  // Proves the end must come after the start.
  it.each(['09:00', '08:59'])('rejects an end time of %s when the class starts at 09:00', (end) => {
    expect(firstMessage({ ...valid, endTime: end })).toBe(
      'The end time must be after the start time.',
    )
  })
})
