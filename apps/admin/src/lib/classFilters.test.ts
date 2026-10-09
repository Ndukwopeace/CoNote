/**
 * Tests for reading the Classes list's filters from the address and writing them back.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { hasClassFilters, readClassFilter, writeClassFilter } from './classFilters'

/** The filter read from a query string. */
function read(query: string) {
  return readClassFilter(new URLSearchParams(query))
}

describe('readClassFilter', () => {
  // Proves an empty address shows the first page of classes in use.
  it('defaults to classes in use', () => {
    expect(read('')).toEqual({ page: 1 })
  })

  // Proves every filter is read.
  it('reads every filter', () => {
    expect(
      read(
        'q=loops&course=c1&summary=in_review&from=2026-09-01&to=2026-09-30&archived=true&sort=-title&page=3',
      ),
    ).toEqual({
      q: 'loops',
      courseId: 'c1',
      summaryStatus: 'in_review',
      from: '2026-09-01',
      to: '2026-09-30',
      archived: true,
      sort: '-title',
      page: 3,
    })
  })

  // Proves "none" is a valid summary filter.
  it('reads the no-summary filter', () => {
    expect(read('summary=none').summaryStatus).toBe('none')
  })

  // Proves a hand-edited address can't pass anything unknown on.
  it('drops invalid values', () => {
    expect(
      read('summary=draft&from=yesterday&to=2026-02-31&archived=yes&sort=id&page=-2&q=%20%20'),
    ).toEqual({ page: 1 })
  })
})

describe('writeClassFilter', () => {
  // Proves defaults are left out and the rest round-trips.
  it('writes only what differs from the default', () => {
    expect(writeClassFilter({ page: 1 })).toEqual({})
    const filter = read('q=loops&course=c1&summary=none&from=2026-09-01&archived=true&page=2')
    expect(readClassFilter(new URLSearchParams(writeClassFilter(filter)))).toEqual(filter)
  })
})

describe('hasClassFilters', () => {
  // Proves the archived view, sort and page don't count as filters.
  it('counts only the search and filters', () => {
    expect(hasClassFilters({ archived: true, sort: 'title', page: 2 })).toBe(false)
    expect(hasClassFilters({ from: '2026-09-01' })).toBe(true)
    expect(hasClassFilters({ summaryStatus: 'none' })).toBe(true)
  })
})
