/**
 * Tests for global search matching (REQUIREMENTS.md section 8): course code and title, class
 * title and note title; never note text.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Factories.
import { makeClass, makeCourse, makeNote } from '@/test/factories'

// The function under test.
import { MIN_QUERY_LENGTH, searchAll } from './search'

/** A small catalog. */
const DATA = {
  courses: [
    makeCourse({ id: 'swe', code: 'SWE 311', title: 'Software Engineering' }),
    makeCourse({ id: 'eng', code: 'ENG 201', title: 'Academic Writing' }),
  ],
  classes: [
    makeClass({ id: 'c1', courseId: 'swe', title: 'Software Requirements' }),
    makeClass({ id: 'c2', courseId: 'eng', title: 'Essay Structure' }),
  ],
  notes: [
    makeNote({ id: 'n1', title: 'Is fast a requirement?', contentHtml: '<p>measurable</p>' }),
    makeNote({ id: 'n2', title: 'Thesis first', contentHtml: '<p>requirement hidden in text</p>' }),
  ],
}

describe('searchAll', () => {
  // Proves matches in each group, ignoring case.
  it('finds courses, classes and notes by title', () => {
    const results = searchAll(DATA, 'REQUIREMENT')
    expect(results.courses).toEqual([])
    expect(results.classes.map((c) => c.id)).toEqual(['c1'])
    expect(results.notes.map((n) => n.id)).toEqual(['n1'])
  })

  // Proves course codes match, with or without the space.
  it.each(['swe 311', 'SWE311', 'software'])('finds the course by %j', (query) => {
    expect(searchAll(DATA, query).courses.map((c) => c.id)).toEqual(['swe'])
  })

  // Proves note text is not searched in v1 (section 8).
  it('does not search inside note text', () => {
    expect(searchAll(DATA, 'measurable').notes).toEqual([])
  })

  // Proves very short queries return nothing, so one letter doesn't list everything.
  it('ignores queries shorter than the minimum', () => {
    const results = searchAll(DATA, 's'.repeat(MIN_QUERY_LENGTH - 1))
    expect([...results.courses, ...results.classes, ...results.notes]).toEqual([])
  })

  // Proves each group is capped.
  it('caps each group', () => {
    const many = {
      ...DATA,
      notes: Array.from({ length: 10 }, (_, i) =>
        makeNote({ id: `x${String(i)}`, title: 'Topic' }),
      ),
    }
    expect(searchAll(many, 'topic', 5).notes).toHaveLength(5)
  })
})
