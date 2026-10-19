/**
 * Builds what the import function receives (D105): the plan's programmes and courses, the
 * teachers the administrator chose, and each course's weekly slots spread over the term.
 */

// Spreads slots over the term.
import { expandSessions, type TermDates } from './term'
// The shapes read and produced.
import type { PlannedSession, TimetablePlan } from './types'

/** What the `import_timetable` database function takes. */
export interface ImportPayload {
  // An IANA time zone name, such as "Africa/Douala".
  timezone: string
  programmes: { code: string; name: string; courseCodes: string[] }[]
  courses: {
    code: string
    title: string
    teacherId: string | null
    sessions: PlannedSession[]
  }[]
}

/**
 * The payload for a plan. `teachers` maps a course code to the chosen teacher's account ID; a
 * course with no entry, or a null one, goes without a teacher.
 */
export function toImportPayload(
  plan: TimetablePlan,
  term: TermDates,
  teachers: Readonly<Record<string, string | null>>,
  timezone: string,
): ImportPayload {
  return {
    timezone,
    programmes: plan.programmes.map((programme) => ({
      code: programme.code,
      name: programme.name,
      courseCodes: [...programme.courseCodes],
    })),
    courses: plan.courses.map((course) => ({
      code: course.code,
      title: course.title,
      teacherId: teachers[course.code] ?? null,
      sessions: expandSessions(course.slots, term, course.title),
    })),
  }
}
