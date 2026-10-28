/**
 * Tests for the My Courses search and the "Ongoing" filter (FR-CRS-2, D120).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// A factory for courses.
import { makeCourse } from '@/test/factories'

// The functions under test.
import { filterCourses, parseCourseStatusFilter } from './courses'

// Three courses covering each field the search looks at.
const courses = [
  makeCourse({
    id: 'swe',
    code: 'SWE 311',
    title: 'Software Engineering',
    inSession: true,
    teacher: { id: 't1', fullName: 'Dr. Smith' },
  }),
  makeCourse({
    id: 'eng',
    code: 'ENG 201',
    title: 'Academic Writing',
    inSession: true,
    teacher: { id: 't2', fullName: 'Mrs. Adeyemi' },
  }),
  makeCourse({
    id: 'bus',
    code: 'BUS 207',
    title: 'Entrepreneurship & Innovation',
    inSession: false,
    teacher: { id: 't3', fullName: 'Mr. Okoro' },
  }),
]

/** The IDs `filterCourses` keeps. */
const ids = (query: string, status: Parameters<typeof filterCourses>[1]['status']) =>
  filterCourses(courses, { query, status }).map((course) => course.id)

describe('filterCourses', () => {
  // Proves an empty search with "All" keeps everything.
  it('keeps every course with no search and "all"', () => {
    expect(ids('', 'all')).toEqual(['swe', 'eng', 'bus'])
  })

  // Proves the search matches code, title and teacher, ignoring case and spaces: [query, ids].
  it.each([
    ['swe', ['swe']],
    ['  writing ', ['eng']],
    ['smith', ['swe']],
    ['INNOV', ['bus']],
    ['nothing matches', []],
  ])('search %j → %j', (query, expected) => {
    expect(ids(query, 'all')).toEqual(expected)
  })

  // Proves "Ongoing" keeps only the courses with a class going on now, and combines with the
  // search (D120).
  it('keeps only courses with a class going on for "ongoing"', () => {
    expect(ids('', 'ongoing')).toEqual(['swe', 'eng'])
    expect(ids('writing', 'ongoing')).toEqual(['eng'])
    expect(ids('innov', 'ongoing')).toEqual([])
  })
})

describe('parseCourseStatusFilter', () => {
  // Proves known values from the address pass through.
  it.each(['all', 'ongoing'])('accepts %s', (value) => {
    expect(parseCourseStatusFilter(value)).toBe(value)
  })

  // SECURITY: proves anything else in the address falls back to "all" instead of reaching the
  // filter logic or the screen (tampered query strings).
  it.each([null, '', 'ONGOING', '<script>', 'archived', 'upcoming', 'completed'])(
    'turns %j into "all"',
    (value) => {
      expect(parseCourseStatusFilter(value)).toBe('all')
    },
  )
})
