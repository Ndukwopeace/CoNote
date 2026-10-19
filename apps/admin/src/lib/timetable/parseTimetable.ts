/**
 * Reads the text of a timetable PDF into each programme's weekly classes (D105). The school's
 * timetable is one page per programme and year: a heading, a header row of weekdays, and a grid
 * whose first column holds the time slots. Nothing here knows about PDFs: it works on text and
 * where the text sits, so it is tested without a file.
 */

// The shapes read and produced.
import type {
  ClassBlock,
  PageProblem,
  PageText,
  ParsedPage,
  ParsedTimetable,
  TextItem,
  Weekday,
} from './types'

/** How far apart (in PDF units) two items may sit vertically and still be on one line. */
const LINE_TOLERANCE = 2
/** How far left of its header a column's text may start. */
const COLUMN_SLACK = 3
/** How far below a time label's first line its second line (the end time) may sit. */
const LABEL_REACH = 20

/** The weekday names a header row holds, with their numbers. */
const WEEKDAYS: Record<string, Weekday> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

/** "Weekly Class Schedule - Software Engineering (SWE)": captures the name and the short code. */
const HEADING = /^Weekly Class Schedule\s*[-–—]\s*(.+?)\s*\(([A-Za-z0-9 ]{2,10})\)\s*$/i
/** "Year 3 - Trimester 1, October 2026": captures the year and the trimester. */
const YEAR_LINE = /^Year\s+(\d+)\s*[-–—]\s*Trimester\s+(\d+)/i
/** A time label's first line: "8:00 AM -". */
const ROW_START = /^\d{1,2}:\d{2}\s*(?:AM|PM)\s*-$/i
/** A time label's second line: "10:00 AM". */
const TIME_END = /^\d{1,2}:\d{2}\s*(?:AM|PM)$/i
/** A whole time range: "8:00 AM - 10:00 AM". */
const TIME_RANGE = /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
/** A course cell: a code such as "MATH 101" or "CERT 301", then the rest. */
const COURSE_CELL = /^([A-Z]{2,5})\s?(\d{3}[A-Z]?)\s+(.+)$/

/** Collapses runs of whitespace into single spaces and trims the ends. */
function tidy(text: string): string {
  // Any run of spaces, tabs or line breaks becomes one space.
  return text.replace(/\s+/g, ' ').trim()
}

/** Items with their text tidied, leaving out the space-only items the PDF holds between words. */
function realItems(items: readonly TextItem[]): TextItem[] {
  return items
    .map((item) => ({ ...item, text: tidy(item.text) }))
    .filter((item) => item.text !== '')
}

/** Items in reading order: top to bottom (lines of equal height together), then left to right. */
function inReadingOrder(items: readonly TextItem[]): TextItem[] {
  return [...items].sort((a, b) => (Math.abs(a.y - b.y) <= LINE_TOLERANCE ? a.x - b.x : b.y - a.y))
}

/** The text of a group of items, in reading order, as one tidy string. */
function textOf(items: readonly TextItem[]): string {
  return tidy(
    inReadingOrder(items)
      .map((item) => item.text)
      .join(' '),
  )
}

/** The lines of a page: items grouped by height, top first, each with its text and its height. */
function linesOf(items: readonly TextItem[]): { y: number; text: string }[] {
  // Top to bottom, so a line's items are neighbours in the list.
  const sorted = [...items].sort((a, b) => b.y - a.y)
  const lines: { y: number; items: TextItem[] }[] = []
  for (const item of sorted) {
    // An item joins the line above it when it sits at about the same height.
    const last = lines.at(-1)
    if (last && Math.abs(last.y - item.y) <= LINE_TOLERANCE) last.items.push(item)
    else lines.push({ y: item.y, items: [item] })
  }
  return lines.map((line) => ({ y: line.y, text: textOf(line.items) }))
}

/** "8", "00", "AM" → "08:00". Noon is "12:00 PM" and midnight "12:00 AM". */
function to24Hour(hour: string, minute: string, meridiem: string): string {
  // 12 AM is 0, 12 PM is 12, other PM hours add 12.
  const base = Number(hour) % 12
  const hours = meridiem.toUpperCase() === 'PM' ? base + 12 : base
  return `${String(hours).padStart(2, '0')}:${minute}`
}

/** What a cell holds. */
type Cell =
  | { kind: 'empty' }
  | { kind: 'other'; text: string }
  | { kind: 'course'; code: string; title: string; teacher: string | null }

/** Reads one cell's text: nothing, something that is not a course, or a course. */
function readCell(text: string): Cell {
  if (text === '') return { kind: 'empty' }
  const match = COURSE_CELL.exec(text)
  // No course code at the start: lunch, fitness, a note.
  if (!match) return { kind: 'other', text }
  const code = `${match[1] ?? ''} ${match[2] ?? ''}`
  const rest = match[3] ?? ''
  // The teacher follows the last " by ", so a title that contains "by" stays whole.
  const at = rest.toLowerCase().lastIndexOf(' by ')
  const title = at === -1 ? rest : rest.slice(0, at)
  const teacher = at === -1 ? null : tidy(rest.slice(at + 4))
  // A cell that is only a code and "by someone" has no title to use.
  if (title.trim() === '') return { kind: 'other', text }
  return { kind: 'course', code, title: tidy(title), teacher: teacher === '' ? null : teacher }
}

/** Joins back-to-back slots of the same course, teacher and title into one longer class. */
function joinNeighbours(blocks: readonly ClassBlock[]): ClassBlock[] {
  const joined: ClassBlock[] = []
  for (const block of blocks) {
    const previous = joined.at(-1)
    // The same course on the same day, starting where the last one ended.
    if (
      previous?.weekday === block.weekday &&
      previous.courseCode === block.courseCode &&
      previous.courseTitle === block.courseTitle &&
      previous.teacherName === block.teacherName &&
      previous.end === block.start
    ) {
      joined[joined.length - 1] = { ...previous, end: block.end }
    } else {
      joined.push(block)
    }
  }
  return joined
}

/**
 * The heights at which the grid's text divides into `rows` rows: the middles of its `rows - 1`
 * biggest gaps between lines. Lines of one cell sit close together and rows sit further apart, so
 * the biggest gaps are the row boundaries. Returns null when there are too few lines to make that
 * many rows.
 */
function rowSplits(items: readonly TextItem[], rows: number): number[] | null {
  // Each distinct line height, top first.
  const heights: number[] = []
  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const last = heights.at(-1)
    if (last === undefined || last - item.y > LINE_TOLERANCE) heights.push(item.y)
  }
  // Fewer lines than rows means a row would have no text at all.
  if (heights.length < rows) return null
  // The gap below each line, with the height halfway across it.
  const gaps: { size: number; middle: number }[] = []
  for (let index = 1; index < heights.length; index += 1) {
    const above = heights[index - 1] ?? 0
    const below = heights[index] ?? 0
    gaps.push({ size: above - below, middle: (above + below) / 2 })
  }
  return gaps
    .sort((a, b) => b.size - a.size)
    .slice(0, rows - 1)
    .map((gap) => gap.middle)
}

/** Reads one page, or says what is wrong with it. */
function parsePage(page: PageText, pageNumber: number): ParsedPage | PageProblem {
  const items = realItems(page.items)
  const lines = linesOf(items)

  // The heading: which programme this is.
  const headingLine = lines.find((line) => HEADING.test(line.text))
  const heading = headingLine ? HEADING.exec(headingLine.text) : null
  if (!headingLine || !heading) {
    return {
      pageNumber,
      message: 'Can\'t find the programme heading ("Weekly Class Schedule - …").',
    }
  }
  // The year line, below the heading.
  const yearLine = lines.find((line) => line.y < headingLine.y && YEAR_LINE.test(line.text))
  const year = yearLine ? YEAR_LINE.exec(yearLine.text) : null
  if (!yearLine || !year) {
    return { pageNumber, message: 'Can\'t find the year and trimester ("Year 1 - Trimester 1").' }
  }
  // Whatever sits between the heading and the year is the specialisation (a track).
  const track =
    lines
      .filter((line) => line.y < headingLine.y && line.y > yearLine.y)
      .map((line) => line.text)
      .join(' ') || null

  // The header row: one item per weekday, left to right. Its left edges are the columns'.
  const dayItems = items
    .filter((item) => item.y < yearLine.y && WEEKDAYS[item.text.toLowerCase()] !== undefined)
    .sort((a, b) => a.x - b.x)
  const firstDay = dayItems[0]
  if (!firstDay) return { pageNumber, message: "Can't find the days of the week." }
  const columns = dayItems.flatMap((item) => {
    const weekday = WEEKDAYS[item.text.toLowerCase()]
    return weekday === undefined ? [] : [{ x: item.x - COLUMN_SLACK, weekday }]
  })
  // The time labels sit left of the first column; everything else belongs to a day.
  const timeEdge = firstDay.x - COLUMN_SLACK
  const timeItems = items.filter((item) => item.x < timeEdge && item.y < firstDay.y)

  // The rows. Their labels ("8:00 AM -") sit at slightly different heights from their cells on
  // different pages, so the rows are found from the cells: the text is split at its biggest
  // vertical gaps, one fewer than there are labels.
  const starts = timeItems.filter((item) => ROW_START.test(item.text)).sort((a, b) => b.y - a.y)
  if (starts.length === 0)
    return { pageNumber, message: "Can't find the times down the left side." }
  const cellItems = items.filter((item) => item.x >= timeEdge && item.y < firstDay.y)
  const splits = rowSplits(cellItems, starts.length)
  if (!splits) return { pageNumber, message: "The rows of classes don't line up with the times." }
  // Which row (0 for the first) a height falls in: how many splits lie above it.
  const rowOf = (y: number) => splits.filter((split) => y < split).length

  const blocks: ClassBlock[] = []
  const ignored = new Set<string>()
  for (const [index, start] of starts.entries()) {
    // The time range is the label's first line and the line just below it.
    const end = timeItems
      .filter(
        (item) => item.y < start.y && start.y - item.y <= LABEL_REACH && TIME_END.test(item.text),
      )
      .sort((a, b) => b.y - a.y)[0]
    const range = TIME_RANGE.exec(`${start.text} ${end?.text ?? ''}`)
    if (!range) {
      return { pageNumber, message: `Can't read the time of the row at "${start.text}".` }
    }
    const from = to24Hour(range[1] ?? '', range[2] ?? '', range[3] ?? '')
    const to = to24Hour(range[4] ?? '', range[5] ?? '', range[6] ?? '')

    // Each day's cell: the items of this row in that column.
    for (const [columnIndex, column] of columns.entries()) {
      const right = columns[columnIndex + 1]?.x ?? Infinity
      const inCell = cellItems.filter(
        (item) => rowOf(item.y) === index && item.x >= column.x && item.x < right,
      )
      const cell = readCell(textOf(inCell))
      if (cell.kind === 'other') ignored.add(cell.text)
      if (cell.kind === 'course') {
        blocks.push({
          weekday: column.weekday,
          start: from,
          end: to,
          courseCode: cell.code,
          courseTitle: cell.title,
          teacherName: cell.teacher,
        })
      }
    }
  }
  if (blocks.length === 0) return { pageNumber, message: 'No course found on this page.' }

  // Joining must keep each day's classes together and in time order.
  const ordered = [...blocks].sort(
    (a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start),
  )
  return {
    pageNumber,
    programmeName: tidy(heading[1] ?? ''),
    shortCode: tidy(heading[2] ?? '').toUpperCase(),
    year: Number(year[1]),
    trimester: Number(year[2]),
    track,
    blocks: joinNeighbours(ordered),
    ignored: [...ignored],
  }
}

/** Reads every page of a timetable. A page that can't be read is reported; the rest are kept. */
export function parseTimetable(pages: readonly PageText[]): ParsedTimetable {
  const result: ParsedTimetable = { pages: [], problems: [] }
  for (const [index, page] of pages.entries()) {
    // Pages are numbered from 1, as a person counts them.
    const parsed = parsePage(page, index + 1)
    if ('message' in parsed) result.problems.push(parsed)
    else result.pages.push(parsed)
  }
  return result
}
