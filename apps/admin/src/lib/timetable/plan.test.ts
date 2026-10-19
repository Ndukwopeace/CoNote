/**
 * Tests for turning the pages of a timetable into the plan an administrator reviews (D105):
 * programmes by year and track, courses found once by code, and warnings for conflicts.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test.
import { buildPlan, programmeCode } from './plan'
// The page shape it reads.
import type { ClassBlock, ParsedPage } from './types'

/** One weekly class, with defaults an example can override. */
function block(overrides: Partial<ClassBlock> = {}): ClassBlock {
  return {
    weekday: 1,
    start: '08:00',
    end: '12:00',
    courseCode: 'MATH 101',
    courseTitle: 'Calculus I',
    teacherName: 'Prof NDAMBOMVE',
    ...overrides,
  }
}

/** One page, with defaults an example can override. */
function page(overrides: Partial<ParsedPage> = {}): ParsedPage {
  return {
    pageNumber: 1,
    programmeName: 'Software Engineering',
    shortCode: 'SWE',
    year: 1,
    trimester: 1,
    track: null,
    blocks: [block()],
    ignored: [],
    ...overrides,
  }
}

describe('programmeCode', () => {
  // Proves a page without a track has the short code and the year.
  it('is the short code and the year', () => {
    expect(programmeCode(page())).toBe('SWE-Y1')
  })

  // Proves a track adds its initials, so two Year 3 pages get two codes.
  it('adds the initials of a track', () => {
    expect(programmeCode(page({ year: 3, track: 'Applied AI Engineering & MLOps' }))).toBe(
      'SWE-Y3-AAEM',
    )
    expect(programmeCode(page({ year: 3, track: 'DevOps, Cloud & Platform Engineering' }))).toBe(
      'SWE-Y3-DCPE',
    )
  })

  // Proves a long track cannot make a code too long for the database (20 characters).
  it('keeps the code within 20 characters', () => {
    const code = programmeCode(
      page({
        shortCode: 'ABCDEFGHIJ',
        year: 3,
        track: 'One Two Three Four Five Six Seven Eight Nine Ten',
      }),
    )

    expect(code.length).toBeLessThanOrEqual(20)
  })
})

describe('buildPlan: programmes', () => {
  // Proves each page becomes a programme named by its year and track, listing its courses once.
  it('makes a programme per page with its courses', () => {
    const plan = buildPlan([
      page({
        blocks: [
          block(),
          block({ weekday: 2, courseCode: 'MATH 101' }),
          block({ weekday: 3, courseCode: 'CYB 101', courseTitle: 'Intro to Cybersecurity' }),
        ],
      }),
    ])

    expect(plan.programmes).toEqual([
      {
        code: 'SWE-Y1',
        name: 'Software Engineering · Year 1',
        courseCodes: ['CYB 101', 'MATH 101'],
      },
    ])
  })

  // Proves the track is part of the programme's name.
  it('names a track in the programme', () => {
    const plan = buildPlan([page({ year: 3, track: 'DevOps, Cloud & Platform Engineering' })])

    expect(plan.programmes[0]?.name).toBe(
      'Software Engineering · Year 3 · DevOps, Cloud & Platform Engineering',
    )
  })

  // Proves two pages for one programme and year are one programme, not two.
  it('merges pages for the same programme', () => {
    const plan = buildPlan([
      page(),
      page({ pageNumber: 2, blocks: [block({ courseCode: 'ENG 101', courseTitle: 'English' })] }),
    ])

    expect(plan.programmes).toHaveLength(1)
    expect(plan.programmes[0]?.courseCodes).toEqual(['ENG 101', 'MATH 101'])
  })
})

describe('buildPlan: courses', () => {
  // Proves a course taken by two programmes is one course.
  it('finds a shared course once', () => {
    const plan = buildPlan([
      page(),
      page({ pageNumber: 2, shortCode: 'CSN', programmeName: 'CyberSecurity & Networking' }),
    ])

    expect(plan.courses.map((course) => course.code)).toEqual(['MATH 101'])
    expect(plan.programmes.map((programme) => programme.code)).toEqual(['SWE-Y1', 'CSN-Y1'])
  })

  // Proves the same slot on two pages is one slot, and different slots are both kept.
  it('keeps each distinct weekly slot once, in week order', () => {
    const plan = buildPlan([
      page({ blocks: [block({ weekday: 3 }), block({ weekday: 1 })] }),
      page({
        pageNumber: 2,
        blocks: [block({ weekday: 1 }), block({ weekday: 1, start: '13:00', end: '15:00' })],
      }),
    ])

    expect(plan.courses[0]?.slots).toEqual([
      { weekday: 1, start: '08:00', end: '12:00', title: 'Calculus I' },
      { weekday: 1, start: '13:00', end: '15:00', title: 'Calculus I' },
      { weekday: 3, start: '08:00', end: '12:00', title: 'Calculus I' },
    ])
  })

  // Proves the teacher names a course has are collected, once each, in order.
  it('collects teacher names', () => {
    const plan = buildPlan([
      page({ blocks: [block({ teacherName: 'Dr A' })] }),
      page({
        pageNumber: 2,
        blocks: [block({ teacherName: 'Dr B' }), block({ weekday: 2, teacherName: 'Dr A' })],
      }),
    ])

    expect(plan.courses[0]?.teacherNames).toEqual(['Dr A', 'Dr B'])
  })

  // Proves a course with no teacher named has an empty list, not a null in it.
  it('leaves out a missing teacher', () => {
    const plan = buildPlan([page({ blocks: [block({ teacherName: null })] })])

    expect(plan.courses[0]?.teacherNames).toEqual([])
  })

  // Proves courses come out A to Z by code, so the review screen is in a steady order.
  it('lists courses A to Z', () => {
    const plan = buildPlan([
      page({
        blocks: [
          block({ courseCode: 'MATH 101' }),
          block({ courseCode: 'BUS 101', courseTitle: 'Business' }),
        ],
      }),
    ])

    expect(plan.courses.map((course) => course.code)).toEqual(['BUS 101', 'MATH 101'])
  })
})

describe('buildPlan: warnings', () => {
  // Proves a code that appears under two titles is flagged once, the first title becomes the
  // course's, and each slot keeps the title it was written with.
  it("warns once when a code has two titles and keeps each slot's own", () => {
    const plan = buildPlan([
      page(),
      page({ pageNumber: 4, blocks: [block({ weekday: 2, courseTitle: 'Calculus One' })] }),
      page({ pageNumber: 5, blocks: [block({ weekday: 3, courseTitle: 'Calculus One' })] }),
    ])

    expect(plan.courses[0]?.title).toBe('Calculus I')
    expect(plan.courses[0]?.slots.map((slot) => slot.title)).toEqual([
      'Calculus I',
      'Calculus One',
      'Calculus One',
    ])
    expect(plan.warnings).toEqual([expect.stringContaining('MATH 101')])
    expect(plan.warnings[0]).toContain('"Calculus I" and "Calculus One"')
  })

  // Proves the same time under two titles is two slots, since they are two activities.
  it('keeps a slot apart from the same time under another title', () => {
    const plan = buildPlan([
      page({ blocks: [block({ courseTitle: 'Capstone' }), block({ courseTitle: 'Review' })] }),
    ])

    expect(plan.courses[0]?.slots).toHaveLength(2)
  })

  // Proves a course with two teachers is flagged so the administrator picks one.
  it('warns when a course has two teachers', () => {
    const plan = buildPlan([
      page({ blocks: [block({ teacherName: 'Dr A' })] }),
      page({ pageNumber: 2, blocks: [block({ teacherName: 'Dr B' })] }),
    ])

    expect(plan.warnings).toEqual([expect.stringContaining('two teachers')])
  })

  // Proves a plan with nothing odd has no warnings.
  it('has no warnings for a clean timetable', () => {
    expect(buildPlan([page(), page({ pageNumber: 2 })]).warnings).toEqual([])
  })

  // Proves the skipped cells of every page are gathered once.
  it('gathers what was ignored once', () => {
    const plan = buildPlan([
      page({ ignored: ['LUNCH BREAK'] }),
      page({ pageNumber: 2, ignored: ['LUNCH BREAK', 'FITNESS'] }),
    ])

    expect(plan.ignored).toEqual(['LUNCH BREAK', 'FITNESS'])
  })
})
