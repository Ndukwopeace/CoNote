/**
 * Tests for reading the Users list's filters from the address and writing them back (admin
 * REQUIREMENTS section 11: filters live in the address).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { hasUserFilters, readUserFilter, writeUserFilter } from './userFilters'

/** The filter read from a query string. */
function read(query: string) {
  return readUserFilter(new URLSearchParams(query))
}

describe('readUserFilter', () => {
  // Proves an empty address shows the first page of students.
  it('defaults to the students tab', () => {
    expect(read('')).toEqual({ role: 'student', page: 1 })
  })

  // Proves every filter is read.
  it('reads the tab, search, filters, sort and page', () => {
    expect(
      read(
        'tab=teachers&q=okoro&status=active&department=English&course=eng-201&sort=-created&page=3',
      ),
    ).toEqual({
      role: 'teacher',
      q: 'okoro',
      status: 'active',
      department: 'English',
      courseId: 'eng-201',
      sort: '-created',
      page: 3,
    })
  })

  // Proves the dashboard's role links open the right tab.
  it('accepts role= from dashboard links', () => {
    expect(read('role=teacher').role).toBe('teacher')
  })

  // Proves values typed into the address by hand can't break the list.
  it('ignores unknown or malformed values', () => {
    expect(read('tab=hackers&status=root&sort=password&page=-2&q=%20%20')).toEqual({
      role: 'student',
      page: 1,
    })
  })
})

describe('writeUserFilter', () => {
  // Proves defaults are left out, so the address stays short.
  it('leaves out defaults', () => {
    expect(writeUserFilter({ role: 'student', page: 1 })).toEqual({})
  })

  // Proves a full filter round-trips through the address.
  it('round-trips through the address', () => {
    const filter = {
      role: 'admin' as const,
      q: 'amara',
      status: 'suspended' as const,
      sort: 'lastActive' as const,
      page: 2,
    }
    expect(read(new URLSearchParams(writeUserFilter(filter)).toString())).toEqual(filter)
  })
})

describe('hasUserFilters', () => {
  // Proves the search and filters count, and the tab, sort and page don't.
  it('counts the search and filters only', () => {
    expect(hasUserFilters({ role: 'teacher', sort: '-created', page: 3 })).toBe(false)
    expect(hasUserFilters({ role: 'student', q: 'ada' })).toBe(true)
    expect(hasUserFilters({ role: 'student', courseId: 'c1' })).toBe(true)
  })
})
