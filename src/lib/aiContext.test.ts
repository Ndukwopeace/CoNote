/**
 * Tests for reading and encoding the Ask AI context (FR-AI-2).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Factories.
import { makeClass, makeCourse } from '@/test/factories'

// The functions under test.
import { contextFromParams, contextKey, contextSearch, parseContextKey } from './aiContext'

/** The student's courses and classes. */
const COURSES = [makeCourse({ id: 'swe-311' })]
const CLASSES = [makeClass({ id: 'swe-311-c2', courseId: 'swe-311' })]

describe('contextFromParams', () => {
  // Proves the page opens on a class, a course, or everything, from the address.
  it.each([
    ['?classId=swe-311-c2', { scope: 'class', courseId: 'swe-311', classId: 'swe-311-c2' }],
    ['?courseId=swe-311', { scope: 'course', courseId: 'swe-311' }],
    ['', { scope: 'all' }],
  ])('reads %j', (search, expected) => {
    expect(contextFromParams(new URLSearchParams(search), COURSES, CLASSES)).toEqual(expected)
  })

  // SECURITY: proves IDs that aren't the student's are ignored, so a crafted link can't point
  // the AI at someone else's course or class.
  it.each(['?classId=other-class', '?courseId=other-course'])('ignores %j', (search) => {
    expect(contextFromParams(new URLSearchParams(search), COURSES, CLASSES)).toEqual({
      scope: 'all',
    })
  })
})

describe('contextKey and parseContextKey', () => {
  // Proves the picker's values round-trip.
  it.each([
    { scope: 'all' } as const,
    { scope: 'course', courseId: 'swe-311' } as const,
    { scope: 'class', courseId: 'swe-311', classId: 'swe-311-c2' } as const,
  ])('round-trips %j', (context) => {
    expect(parseContextKey(contextKey(context), COURSES, CLASSES)).toEqual(context)
  })

  // SECURITY: proves an unknown value becomes "all".
  it('reads an unknown value as all courses', () => {
    expect(parseContextKey('class:nope', COURSES, CLASSES)).toEqual({ scope: 'all' })
  })
})

describe('contextSearch', () => {
  // Proves the address written back for each context.
  it.each([
    [{ scope: 'all' } as const, ''],
    [{ scope: 'course', courseId: 'swe-311' } as const, '?courseId=swe-311'],
    [
      { scope: 'class', courseId: 'swe-311', classId: 'swe-311-c2' } as const,
      '?classId=swe-311-c2',
    ],
  ])('writes %j as %j', (context, search) => {
    expect(contextSearch(context)).toBe(search)
  })
})
