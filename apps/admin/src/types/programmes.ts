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
  // Requests to join it that wait for an administrator.
  pendingRequestCount: number
}

/** A student's request to join a programme, waiting for an administrator (D106). */
export interface ProgrammeRequestItem {
  id: string
  programmeId: string
  // "SWE-Y3".
  programmeCode: string
  programmeName: string
  studentId: string
  studentName: string
  studentEmail: string
  // When they asked, as ISO text.
  createdAt: string
}

/** A student who joined a programme. */
export interface ProgrammeMember {
  studentId: string
  studentName: string
  studentEmail: string
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
