/**
 * Tests for reading the Courses list's filters from the address and writing them back.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { hasCourseFilters, readCourseFilter, writeCourseFilter } from './courseFilters'

/** The filter read from a query string. */
function read(query: string) {
  return readCourseFilter(new URLSearchParams(query))
}

describe('readCourseFilter', () => {
  // Proves an empty address shows the first page of courses in use.
  it('defaults to courses in use', () => {
    expect(read('')).toEqual({ page: 1 })
  })

  // Proves every filter is read, including the dashboard's "no teacher" link.
  it('reads every filter', () => {
    expect(
      read(
        'q=swe&status=ongoing&department=English&teacher=none&archived=true&sort=-students&page=2',
      ),
    ).toEqual({
      q: 'swe',
      status: 'ongoing',
      department: 'English',
      teacher: 'none',
      archived: true,
      sort: '-students',
      page: 2,
    })
  })

  // Proves values typed into the address by hand can't break the list.
  it('ignores unknown or malformed values', () => {
    expect(read('status=closed&archived=maybe&sort=random&page=zero')).toEqual({ page: 1 })
  })
})

describe('writeCourseFilter', () => {
  // Proves a filter round-trips through the address, defaults left out.
  it('round-trips through the address, leaving out defaults', () => {
    const filter = { q: 'eng', teacher: 't1', archived: true, sort: 'title' as const, page: 3 }
    expect(read(new URLSearchParams(writeCourseFilter(filter)).toString())).toEqual(filter)
    expect(writeCourseFilter({ page: 1 })).toEqual({})
  })
})

describe('hasCourseFilters', () => {
  // Proves the search and filters count; archived, sort and page don't.
  it('counts the search and filters only', () => {
    expect(hasCourseFilters({ archived: true, sort: 'title', page: 2 })).toBe(false)
    expect(hasCourseFilters({ teacher: 'none' })).toBe(true)
  })
})
