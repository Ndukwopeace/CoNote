/**
 * Tests for reading a timetable PDF's text into programmes' weekly classes (D105).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Page builders that lay text out like the school's PDF.
import { buildPage, ordinaryPage } from '@/test/timetablePage'

// The function under test.
import { parseTimetable } from './parseTimetable'

describe('parseTimetable: the heading', () => {
  // Proves the programme, its short code, the year and the trimester are read from the heading.
  it('reads the programme, year and trimester', () => {
    const { pages, problems } = parseTimetable([ordinaryPage()])

    expect(problems).toEqual([])
    expect(pages[0]).toMatchObject({
      pageNumber: 1,
      programmeName: 'Software Engineering',
      shortCode: 'SWE',
      year: 1,
      trimester: 1,
      track: null,
    })
  })

  // Proves a line under the heading that names a specialisation is kept as the track.
  it('reads a track line between the heading and the year', () => {
    const page = buildPage({
      heading: 'Weekly Class Schedule - Software Engineering (SWE)',
      track: 'Applied AI Engineering & MLOps',
      yearLine: 'Year 3 - Trimester 1, October 2026',
      rows: [
        {
          time: '8:00 AM - 10:00 AM',
          cells: [['SWE 321 Generative AI', 'by Dr Sop'], [], [], [], []],
        },
      ],
    })

    expect(parseTimetable([page]).pages[0]).toMatchObject({
      year: 3,
      track: 'Applied AI Engineering & MLOps',
    })
  })

  // Proves a heading that names a programme with an ampersand and a long name still reads.
  it('reads a long programme name', () => {
    const page = buildPage({
      heading: 'Weekly Class Schedule - Business Management & Startup Building (BMS)',
      yearLine: 'Year 2 - Trimester 1, October 2026',
      rows: [
        {
          time: '8:00 AM - 10:00 AM',
          cells: [['BUS 105 IT for Business', 'by Dr SEPPO'], [], [], [], []],
        },
      ],
    })

    expect(parseTimetable([page]).pages[0]).toMatchObject({
      programmeName: 'Business Management & Startup Building',
      shortCode: 'BMS',
    })
  })
})

describe('parseTimetable: the classes', () => {
  // Proves two slots in a row for the same course become one four-hour class.
  it('joins back-to-back slots of one course into one block', () => {
    const [page] = parseTimetable([ordinaryPage()]).pages

    const monday = page?.blocks.filter((block) => block.weekday === 1)
    expect(monday?.[0]).toMatchObject({
      courseCode: 'MATH 101',
      courseTitle: 'Calculus I',
      teacherName: 'Prof NDAMBOMVE',
      start: '08:00',
      end: '12:00',
    })
  })

  // Proves the afternoon slot stays separate: lunch sits between, and it is another course.
  it('keeps the afternoon class apart from the morning one', () => {
    const [page] = parseTimetable([ordinaryPage()]).pages

    const monday = page?.blocks
      .filter((block) => block.weekday === 1)
      .map((b) => `${b.courseCode} ${b.start}-${b.end}`)
    expect(monday).toEqual(['MATH 101 08:00-12:00', 'ENG 101 13:00-15:00'])
  })

  // Proves a title that wraps over lines is read whole, and the teacher is what follows "by".
  it('reads a wrapped title and the teacher after "by"', () => {
    const [page] = parseTimetable([ordinaryPage()]).pages

    const tuesday = page?.blocks.find((block) => block.weekday === 2)
    expect(tuesday).toMatchObject({
      courseCode: 'CYB 101',
      courseTitle: 'Intro to Cybersecurity',
      teacherName: 'Mr TAGWAN',
    })
    const friday = page?.blocks.find((block) => block.weekday === 5)
    expect(friday).toMatchObject({
      courseTitle: 'Version Control Systems',
      teacherName: 'Mr ZEMAGHO',
    })
  })

  // Proves a title that itself contains "by" splits on the last one.
  it('splits on the last "by"', () => {
    const page = buildPage({
      heading: 'Weekly Class Schedule - Software Engineering (SWE)',
      yearLine: 'Year 1 - Trimester 1, October 2026',
      rows: [
        {
          time: '8:00 AM - 10:00 AM',
          cells: [['SWE 110 Learning by Doing', 'by Dr ABC'], [], [], [], []],
        },
      ],
    })

    expect(parseTimetable([page]).pages[0]?.blocks[0]).toMatchObject({
      courseTitle: 'Learning by Doing',
      teacherName: 'Dr ABC',
    })
  })

  // Proves a course with no "by" has a title and no teacher.
  it('gives no teacher when the cell names none', () => {
    const page = buildPage({
      heading: 'Weekly Class Schedule - Software Engineering (SWE)',
      yearLine: 'Year 1 - Trimester 1, October 2026',
      rows: [{ time: '8:00 AM - 10:00 AM', cells: [['SWE 111 Workshop'], [], [], [], []] }],
    })

    expect(parseTimetable([page]).pages[0]?.blocks[0]).toMatchObject({
      courseTitle: 'Workshop',
      teacherName: null,
    })
  })

  // Proves lunch and the fitness slot are skipped, listed once, and never become courses.
  it('lists cells that are not courses once and skips them', () => {
    const [page] = parseTimetable([ordinaryPage()]).pages

    expect(page?.ignored).toEqual([
      'LUNCH BREAK',
      'FIRESIDE CHAT DISCUSSIONS / HIGH-INTENSITY FITNESS',
    ])
    expect(page?.blocks.every((block) => /^[A-Z]{2,5} \d{3}/.test(block.courseCode))).toBe(true)
  })

  // Proves empty cells are not reported as anything.
  it('does not report empty cells', () => {
    const [page] = parseTimetable([ordinaryPage()]).pages

    expect(page?.ignored).not.toContain('')
  })

  // Proves the 12-hour labels become 24-hour times, including noon and the afternoon.
  it('reads AM and PM times', () => {
    const [page] = parseTimetable([ordinaryPage()]).pages

    const times = page?.blocks.map((block) => `${block.start}-${block.end}`)
    expect(times).toContain('13:00-15:00')
    expect(times).toContain('08:00-12:00')
  })

  // Proves the pages are read independently and numbered.
  it('reads every page', () => {
    const { pages } = parseTimetable([ordinaryPage(), ordinaryPage()])

    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2])
  })
})

describe('parseTimetable: layouts that differ from the usual', () => {
  // Proves rows are found when the time label sits lower than the cell's first line, so a label
  // does not claim the lines of the row above or below it.
  it('reads rows whose time label sits lower than their cells', () => {
    const page = buildPage({
      heading: 'Weekly Class Schedule - Business Management & Startup Building (BMS)',
      yearLine: 'Year 2 - Trimester 1, October 2026',
      rows: [
        {
          time: '8:00 AM - 10:00 AM',
          labelDrop: 12.7,
          cells: [
            ['CERT 203 HubSpot', 'Content Marketing', 'Certification by Mme', 'GUEGANG'],
            [],
            [],
            [],
            [],
          ],
        },
        {
          time: '12:00 PM - 1:00 PM',
          labelDrop: 0,
          cells: [['LUNCH BREAK'], ['LUNCH BREAK'], [], [], []],
        },
        {
          time: '1:00 PM - 3:00 PM',
          labelDrop: 12.7,
          cells: [
            ['BUS 215 Market', 'Research and', 'Experimental Methods', 'by Dr SEPPO'],
            [],
            [],
            [],
            [],
          ],
        },
      ],
    })

    const { pages, problems } = parseTimetable([page])

    expect(problems).toEqual([])
    expect(
      pages[0]?.blocks.map(
        (block) => `${block.courseCode} ${block.start}-${block.end} ${block.teacherName}`,
      ),
    ).toEqual(['CERT 203 08:00-10:00 Mme GUEGANG', 'BUS 215 13:00-15:00 Dr SEPPO'])
    expect(pages[0]?.ignored).toEqual(['LUNCH BREAK'])
  })

  // Proves rows are still told apart when every cell is a single line.
  it('reads a page where every cell is one line', () => {
    const page = buildPage({
      heading: 'Weekly Class Schedule - Software Engineering (SWE)',
      yearLine: 'Year 1 - Trimester 1, October 2026',
      rows: [
        {
          time: '8:00 AM - 10:00 AM',
          cells: [['SWE 111 Workshop'], ['MTH 111 Algebra'], [], [], []],
        },
        { time: '10:00 AM - 12:00 PM', cells: [['SWE 112 Studio'], [], [], [], []] },
        { time: '1:00 PM - 3:00 PM', cells: [[], ['MTH 111 Algebra'], [], [], []] },
      ],
    })

    const blocks = parseTimetable([page]).pages[0]?.blocks.map(
      (b) => `${b.weekday} ${b.courseCode} ${b.start}-${b.end}`,
    )

    expect(blocks).toEqual([
      '1 SWE 111 08:00-10:00',
      '1 SWE 112 10:00-12:00',
      '2 MTH 111 08:00-10:00',
      '2 MTH 111 13:00-15:00',
    ])
  })
})

describe('parseTimetable: pages it cannot read', () => {
  // Proves a page with no programme heading is reported with its number, not guessed at.
  it('reports a page without a heading', () => {
    const page = buildPage({
      yearLine: 'Year 1 - Trimester 1, October 2026',
      rows: [{ time: '8:00 AM - 10:00 AM', cells: [['SWE 111 Workshop'], [], [], [], []] }],
    })

    const { pages, problems } = parseTimetable([ordinaryPage(), page])

    expect(pages).toHaveLength(1)
    expect(problems).toHaveLength(1)
    expect(problems[0]?.pageNumber).toBe(2)
    expect(problems[0]?.message).toContain('programme')
  })

  // Proves a page with no weekday columns is reported.
  it('reports a page without weekday columns', () => {
    const page = buildPage({
      heading: 'Weekly Class Schedule - Software Engineering (SWE)',
      yearLine: 'Year 1 - Trimester 1, October 2026',
      days: [],
      rows: [],
    })

    const [problem] = parseTimetable([page]).problems

    expect(problem?.pageNumber).toBe(1)
    expect(problem?.message).toContain('days')
  })

  // Proves a page with no time rows is reported.
  it('reports a page without time slots', () => {
    const page = buildPage({
      heading: 'Weekly Class Schedule - Software Engineering (SWE)',
      yearLine: 'Year 1 - Trimester 1, October 2026',
      rows: [],
    })

    const [problem] = parseTimetable([page]).problems

    expect(problem?.pageNumber).toBe(1)
    expect(problem?.message).toContain('times')
  })

  // Proves a page with courses nowhere is reported, since importing it would do nothing.
  it('reports a page with no courses', () => {
    const page = buildPage({
      heading: 'Weekly Class Schedule - Software Engineering (SWE)',
      yearLine: 'Year 1 - Trimester 1, October 2026',
      rows: [{ time: '12:00 PM - 1:00 PM', cells: [['LUNCH BREAK'], [], [], [], []] }],
    })

    const [problem] = parseTimetable([page]).problems

    expect(problem?.pageNumber).toBe(1)
    expect(problem?.message).toContain('course')
  })

  // Proves an empty file gives no pages and no crash.
  it('handles a file with no pages', () => {
    expect(parseTimetable([])).toEqual({ pages: [], problems: [] })
  })
})
