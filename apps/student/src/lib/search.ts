/**
 * Global search matching (REQUIREMENTS.md section 8). v1 matches course code and title, class
 * title and note title. It never looks inside note text; full-text search comes with the backend.
 */

// Shapes.
import type { ClassSession, Course, Note } from '@/types/domain'

/** Queries shorter than this return nothing, so one letter doesn't list everything. */
export const MIN_QUERY_LENGTH = 2
/** Most results per group by default. */
const DEFAULT_LIMIT = 5

/** What search looks through. */
export interface SearchData {
  courses: readonly Course[]
  classes: readonly ClassSession[]
  notes: readonly Note[]
}

/** The matches, grouped by type. */
export interface SearchResults {
  courses: Course[]
  classes: ClassSession[]
  notes: Note[]
}

/** Text for matching: lower case, with spaces removed so "SWE311" finds "SWE 311". */
function fold(text: string) {
  return text.toLowerCase().replace(/\s+/g, '')
}

/** Matches for `query`, up to `limit` per group, in the order the lists came in. */
export function searchAll(data: SearchData, query: string, limit = DEFAULT_LIMIT): SearchResults {
  // Too short: nothing.
  const needle = fold(query)
  if (needle.length < MIN_QUERY_LENGTH) return { courses: [], classes: [], notes: [] }
  // True when any field contains the query.
  const matches = (...fields: (string | undefined)[]) =>
    fields.some((field) => fold(field ?? '').includes(needle))
  return {
    courses: data.courses.filter((c) => matches(c.code, c.title)).slice(0, limit),
    classes: data.classes.filter((c) => matches(c.title)).slice(0, limit),
    notes: data.notes.filter((n) => matches(n.title)).slice(0, limit),
  }
}
