/**
 * Builds the positioned text of a timetable page for tests, laid out like the school's PDF: a
 * heading, a header row of weekdays, time labels split over two lines in the first column, and
 * cells whose text wraps over several lines. No real names or files are needed.
 */

// The page shape the importer reads.
import type { PageText, TextItem } from '@/lib/timetable/types'

/** The height of one line of text, as in the PDF. */
const LINE = 12.7
/** Where the first weekday column starts. */
const FIRST_COLUMN_X = 126.8
/** The distance between weekday columns. */
const COLUMN_STEP = 124.5

/** One row of the grid: its time label and the lines in each weekday's cell. */
export interface RowSpec {
  // "8:00 AM - 10:00 AM".
  time: string
  // One entry per weekday; each entry is the cell's lines, top to bottom (empty for no class).
  cells: readonly (readonly string[])[]
  // How far below the cells' first line the time label sits. The BMS Year 2 page has labels one
  // line lower than their cells; most pages have none.
  labelDrop?: number
}

/** What a page holds. */
export interface PageSpec {
  heading?: string
  track?: string
  yearLine?: string
  days?: readonly string[]
  rows: readonly RowSpec[]
}

/** The weekday names a normal page has. */
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

/** Turns a spec into the items of a page. */
export function buildPage(spec: PageSpec): PageText {
  // The items, collected as the page is laid out from the top.
  const items: TextItem[] = []
  /** Adds one line of text. */
  const add = (text: string, x: number, y: number) => {
    items.push({ text, x, y })
  }
  // The heading block.
  add('Last Updated : Oct 15, 2026', 320, 490)
  if (spec.heading !== undefined) add(spec.heading, 200, 464)
  let y = 464
  if (spec.track) {
    y -= 26
    add(spec.track, 290, y)
  }
  if (spec.yearLine !== undefined) {
    y -= 26
    add(spec.yearLine, 273, y)
  }
  // The header row.
  y -= 44
  const headerY = y
  const days = spec.days ?? WEEK
  add('Time Slot', 48.8, headerY)
  days.forEach((day, index) => {
    // A space-only item sits after each name in the real file; the reader must ignore it.
    add(day, FIRST_COLUMN_X + index * COLUMN_STEP, headerY)
    add(' ', FIRST_COLUMN_X + index * COLUMN_STEP + 40, headerY)
  })
  // The rows, each as tall as its longest cell.
  let rowY = headerY - 38
  for (const row of spec.rows) {
    // The time label is two lines: "8:00 AM -" and "10:00 AM".
    const [from = '', to = ''] = row.time.split(/\s*-\s*/)
    const labelY = rowY - (row.labelDrop ?? 0)
    add(`${from} -`, 50.3, labelY)
    add(to, 50.3, labelY - LINE)
    // Each cell's lines, the first line as several items the way the PDF splits styled runs.
    row.cells.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        const x = FIRST_COLUMN_X + index * COLUMN_STEP
        const words = line.split(' ')
        // The first line is split in two, with a space-only item between, like bold + normal.
        if (lineIndex === 0 && words.length > 2) {
          add(words.slice(0, 2).join(' '), x, rowY - lineIndex * LINE)
          add(' ', x + 40, rowY - lineIndex * LINE)
          add(words.slice(2).join(' '), x + 45, rowY - lineIndex * LINE)
        } else {
          add(line, x, rowY - lineIndex * LINE)
        }
      })
    })
    // The next row starts below this one's tallest cell, plus the cell padding.
    const tallest = Math.max(2, ...row.cells.map((lines) => lines.length))
    rowY -= tallest * LINE + 30
  }
  return { items }
}

/** A complete, ordinary page: the Software Engineering week, trimmed to what tests need. */
export function ordinaryPage(): PageText {
  return buildPage({
    heading: 'Weekly Class Schedule - Software Engineering (SWE)',
    yearLine: 'Year 1 - Trimester 1, October 2026',
    rows: [
      {
        time: '8:00 AM - 10:00 AM',
        cells: [
          ['MATH 101 Calculus I', 'by Prof NDAMBOMVE'],
          ['CYB 101 Intro to', 'Cybersecurity by Mr', 'TAGWAN'],
          [],
          [],
          ['SWE 102 Version', 'Control Systems by', 'Mr ZEMAGHO'],
        ],
      },
      {
        time: '10:00 AM - 12:00 PM',
        cells: [
          ['MATH 101 Calculus I', 'by Prof NDAMBOMVE'],
          ['CYB 101 Intro to', 'Cybersecurity by Mr', 'TAGWAN'],
          [],
          [],
          ['SWE 102 Version', 'Control Systems by', 'Mr ZEMAGHO'],
        ],
      },
      {
        time: '12:00 PM - 1:00 PM',
        cells: [
          ['LUNCH BREAK'],
          ['LUNCH BREAK'],
          ['LUNCH BREAK'],
          ['LUNCH BREAK'],
          ['LUNCH BREAK'],
        ],
      },
      {
        time: '1:00 PM - 3:00 PM',
        cells: [
          ['ENG 101 English for', 'Business & Tech 1 by', 'Dr MAJEU'],
          [],
          [],
          [],
          ['FIRESIDE CHAT', 'DISCUSSIONS /', 'HIGH-INTENSITY', 'FITNESS'],
        ],
      },
    ],
  })
}
