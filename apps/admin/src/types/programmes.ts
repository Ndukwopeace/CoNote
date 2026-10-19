/**
 * The shapes the programme screens and the timetable import use (D105).
 */

/** One row of the Programmes list. */
export interface ProgrammeListItem {
  id: string
  // "SWE-Y1".
  code: string
  // "Software Engineering · Year 1".
  name: string
  // Whether students may join it themselves.
  openEnrolment: boolean
  // The courses it holds, in use or not.
  courseCount: number
  // The students who joined it.
  studentCount: number
}

/** What an import did, or, for a dry run, would do. */
export interface ImportOutcome {
  programmesCreated: number
  programmesExisting: number
  coursesCreated: number
  coursesExisting: number
  classesCreated: number
  classesSkipped: number
  teachersAssigned: number
}
