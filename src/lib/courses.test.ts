/**
 * Tests for the My Courses search and status filter (FR-CRS-2).
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
    status: 'ongoing',
    teacher: { id: 't1', fullName: 'Dr. Smith' },
  }),
  makeCourse({
    id: 'eng',
    code: 'ENG 201',
    title: 'Academic Writing',
    status: 'ongoing',
    teacher: { id: 't2', fullName: 'Mrs. Adeyemi' },
  }),
  makeCourse({
    id: 'bus',
    code: 'BUS 207',
    title: 'Entrepreneurship & Innovation',
    status: 'upcoming',
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

  // Proves the status filter and the search combine.
  it('combines the search with the status filter', () => {
    expect(ids('', 'upcoming')).toEqual(['bus'])
    expect(ids('writing', 'ongoing')).toEqual(['eng'])
    expect(ids('writing', 'upcoming')).toEqual([])
    expect(ids('', 'completed')).toEqual([])
  })
})

describe('parseCourseStatusFilter', () => {
  // Proves known values from the address pass through.
  it.each(['all', 'ongoing', 'upcoming', 'completed'])('accepts %s', (value) => {
    expect(parseCourseStatusFilter(value)).toBe(value)
  })

  // SECURITY: proves anything else in the address falls back to "all" instead of reaching the
  // filter logic or the screen (tampered query strings).
  it.each([null, '', 'ONGOING', '<script>', 'archived'])('turns %j into "all"', (value) => {
    expect(parseCourseStatusFilter(value)).toBe('all')
  })
})
