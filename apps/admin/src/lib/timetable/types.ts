/**
 * The shapes the timetable import passes around: text read from a PDF page, what one page of a
 * timetable says, and the plan the administrator reviews before anything is created (D105).
 */

/** One piece of text on a PDF page and where it starts. `y` grows upwards, as in a PDF. */
export interface TextItem {
  text: string
  x: number
  y: number
}

/** The text of one PDF page. */
export interface PageText {
  items: readonly TextItem[]
}

/** A day of the week, 1 for Monday to 7 for Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** One class a week: a course on a weekday between two times (24-hour "HH:MM"). */
export interface ClassBlock {
  weekday: Weekday
  start: string
  end: string
  courseCode: string
  courseTitle: string
  // The name as the timetable writes it ("Dr TCHOKOTE"), or null when it names nobody.
  teacherName: string | null
}

/** What one page of the timetable says: one programme's week. */
export interface ParsedPage {
  pageNumber: number
  // "Software Engineering (SWE)": the name and the short code from the heading.
  programmeName: string
  shortCode: string
  year: number
  trimester: number
  // A line under the heading that names a specialisation, or null.
  track: string | null
  blocks: ClassBlock[]
  // Cells that are not courses (lunch, fitness), each listed once.
  ignored: string[]
}

/** Something on a page the importer could not read. */
export interface PageProblem {
  pageNumber: number
  message: string
}

/** Everything read from the file. */
export interface ParsedTimetable {
  pages: ParsedPage[]
  problems: PageProblem[]
}

/** A programme the import will create or find: a page's programme, year and track. */
export interface PlannedProgramme {
  // "SWE-Y1", or "SWE-Y3-AAEM" when the page has a track.
  code: string
  name: string
  courseCodes: string[]
}

/** A weekly slot of a course, with the title it was written under. */
export interface PlannedSlot {
  weekday: Weekday
  start: string
  end: string
  // Usually the course's title; a code the school reuses for other activities has others.
  title: string
}

/** A course the import will create or find, with where it meets. */
export interface PlannedCourse {
  code: string
  title: string
  // The teacher names the timetable gives for it, in the order first seen.
  teacherNames: string[]
  slots: PlannedSlot[]
}

/** The reviewable result of reading a timetable. */
export interface TimetablePlan {
  programmes: PlannedProgramme[]
  courses: PlannedCourse[]
  // Things worth a second look: a course titled two ways, taught by two people.
  warnings: string[]
  // Cells skipped because they are not courses, each listed once.
  ignored: string[]
}

/** One dated class the import will create: local date and time, with no offset. */
export interface PlannedSession {
  // "2026-10-19T08:00".
  start: string
  end: string
  // "Week 2": the teacher renames it later.
  title: string
}
