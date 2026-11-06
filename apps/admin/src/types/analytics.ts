/**
 * What the Analytics page shows (admin REQUIREMENTS section 16, D124). Everything here is a count
 * or a class name: no student's name and no note text ever reaches this page.
 */

/** The periods the page offers, in days counted back from now. */
export type AnalyticsDays = 7 | 30 | 90

/** A period: `from` is included and `to` is not. Both are ISO 8601 times. */
export interface AnalyticsPeriod {
  from: string
  to: string
}

/** Everything the page shows apart from the class table. */
export interface AnalyticsReport {
  users: {
    // Accounts with the student role and with the teacher role, whatever their status.
    students: number
    teachers: number
    // Students and teachers whose account was created inside the period.
    newUsers: number
    // Students and teachers who signed in within the last 7 and the last 30 days.
    active7: number
    active30: number
    // Active accounts that have not signed in for 30 days, or ever.
    inactive: number
  }
  academic: {
    // Courses in use (not archived).
    courses: number
    // Classes that start inside the period.
    classes: number
    // Notes written inside the period.
    notesCreated: number
    // Drafts finished and summaries published inside the period.
    summariesGenerated: number
    summariesPublished: number
    // Drafts waiting for a teacher right now.
    draftsWaiting: number
  }
  ai: {
    // Jobs queued inside the period, and how they ended.
    total: number
    succeeded: number
    failed: number
    // Average seconds from queued to finished for the jobs that succeeded; null when none did.
    averageSeconds: number | null
  }
  participation: {
    // Students who wrote at least one note inside the period.
    studentsWhoWrote: number
    // Students enrolled in a course that had a class inside the period.
    studentsExpected: number
  }
}

/** One class in the participation table. */
export interface ClassParticipation {
  classId: string
  classNumber: number
  classTitle: string
  // ISO 8601 start.
  startsAt: string
  courseId: string
  courseCode: string
  // Notes the class has, different students who wrote them, and students enrolled in its course.
  notes: number
  writers: number
  enrolled: number
}
