/**
 * Tests for the Notes page filter, search and sort (FR-NTE-7).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Note factory.
import { makeNote } from '@/test/factories'

// The functions under test.
import { filterNotes, parseNoteSort } from './noteList'

/** Three notes across two courses, edited on different days. */
const NOTES = [
  makeNote({ id: 'a', courseId: 'swe', title: 'Waterfall', updatedAt: '2026-09-20T10:00:00Z' }),
  makeNote({
    id: 'b',
    courseId: 'eng',
    title: 'Thesis',
    tags: ['Question'],
    updatedAt: '2026-09-25T10:00:00Z',
  }),
  makeNote({
    id: 'c',
    courseId: 'swe',
    title: 'Agile',
    contentHtml: '<p>Sprints and backlog</p>',
    updatedAt: '2026-09-22T10:00:00Z',
  }),
]

describe('filterNotes', () => {
  // Proves the default: every note, newest edit first.
  it('sorts newest first by default', () => {
    expect(
      filterNotes(NOTES, { courseId: '', query: '', sort: 'newest' }).map((n) => n.id),
    ).toEqual(['b', 'c', 'a'])
  })

  // Proves the oldest-first sort.
  it('sorts oldest first', () => {
    expect(
      filterNotes(NOTES, { courseId: '', query: '', sort: 'oldest' }).map((n) => n.id),
    ).toEqual(['a', 'c', 'b'])
  })

  // Proves the course filter.
  it('filters by course', () => {
    expect(
      filterNotes(NOTES, { courseId: 'swe', query: '', sort: 'newest' }).map((n) => n.id),
    ).toEqual(['c', 'a'])
  })

  // Proves search looks at title, tags and the note's text, ignoring case.
  it.each([
    ['waterfall', ['a']],
    ['question', ['b']],
    ['BACKLOG', ['c']],
    ['<p>', []],
  ])('searches for %j', (query, ids) => {
    expect(filterNotes(NOTES, { courseId: '', query, sort: 'newest' }).map((n) => n.id)).toEqual(
      ids,
    )
  })
})

describe('parseNoteSort', () => {
  // SECURITY: proves only known sorts come from the address.
  it.each([
    ['oldest', 'oldest'],
    ['newest', 'newest'],
    [null, 'newest'],
    ['drop table', 'newest'],
  ])('reads %j as %j', (value, expected) => {
    expect(parseNoteSort(value)).toBe(expected)
  })
})
