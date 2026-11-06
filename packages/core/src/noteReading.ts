/**
 * What the teacher and admin apps share when they read students' notes (D123): the shapes, the
 * service each app offers, the counts shown above a class's notes, and the search the demo data
 * uses (the real database does the same in `search_notes`).
 */

/** How many notes a screen shows at a time. */
export const NOTES_PAGE_SIZE = 20

/** The most notes one request may ask for; the database caps it the same way. */
const MAX_PAGE_SIZE = 100

/** One note with the student who wrote it. `contentHtml` is shown as text, never as HTML. */
export interface NoteEntry {
  id: string
  classId: string
  classNumber: number
  classTitle: string
  courseId: string
  courseCode: string
  courseTitle: string
  studentId: string
  studentName: string
  studentNumber: string | null
  title: string | null
  contentHtml: string
  // ISO 8601 times.
  createdAt: string
  updatedAt: string
}

/** What to look for. Every field is optional, and the filters add up. */
export interface NoteSearchQuery {
  courseId?: string | undefined
  classId?: string | undefined
  // One exact student.
  studentId?: string | undefined
  // Part of a student's name, email or student number, matched as plain text.
  studentText?: string | undefined
  // How many to return, from 1 to 100; NOTES_PAGE_SIZE when left out.
  limit?: number | undefined
  // How many matches to skip.
  offset?: number | undefined
}

/** One page of notes, newest first, and how many notes match in all. */
export interface NotePage {
  notes: NoteEntry[]
  total: number
}

/** One student of a class and how many notes they wrote for it. */
export interface NoteRosterEntry {
  studentId: string
  studentName: string
  studentNumber: string | null
  noteCount: number
}

/**
 * Reading notes: each app offers this through its services. The signed-in teacher gets the notes
 * of the courses they teach, an administrator gets any course, and anyone else is refused.
 */
export interface NoteReadingService {
  /** Notes that match `query`, newest first, a page at a time. */
  searchNotes(query: NoteSearchQuery): Promise<NotePage>
  /**
   * Every student of the class's course (and anyone who wrote a note and has left), each with
   * their note count, by name. Rejects with not_found for an unknown class, and with forbidden for
   * a class the signed-in teacher does not teach.
   */
  getNoteRoster(classId: string): Promise<NoteRosterEntry[]>
}

/** The numbers above a class's notes: "37 notes from 23 of 27 students". */
export interface RosterSummary {
  notes: number
  // Students who wrote at least one note.
  writers: number
  // Students on the roster.
  students: number
  // Those who wrote none.
  silent: NoteRosterEntry[]
}

/** Totals for a class's roster. */
export function rosterSummary(roster: readonly NoteRosterEntry[]): RosterSummary {
  return {
    notes: roster.reduce((sum, entry) => sum + entry.noteCount, 0),
    writers: roster.filter((entry) => entry.noteCount > 0).length,
    students: roster.length,
    silent: roster.filter((entry) => entry.noteCount === 0),
  }
}

/**
 * The notes of `entries` that match `query`, as one page. This is what the demo data answers with,
 * and it follows the database's rules: newest first, plain-text matching, a page of at most 100.
 */
export function searchNoteEntries(entries: readonly NoteEntry[], query: NoteSearchQuery): NotePage {
  // Lower case, so "ADA" finds "Ada".
  const text = (query.studentText ?? '').trim().toLowerCase()
  const matches = entries
    .filter(
      (entry) =>
        (query.courseId === undefined || entry.courseId === query.courseId) &&
        (query.classId === undefined || entry.classId === query.classId) &&
        (query.studentId === undefined || entry.studentId === query.studentId) &&
        // A plain substring test, so "%" and "_" mean themselves.
        (text === '' ||
          entry.studentName.toLowerCase().includes(text) ||
          (entry.studentNumber ?? '').toLowerCase().includes(text)),
    )
    // Newest first; the ID breaks a tie so the order never changes between requests.
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
  const limit = Math.min(Math.max(query.limit ?? NOTES_PAGE_SIZE, 1), MAX_PAGE_SIZE)
  const offset = Math.max(query.offset ?? 0, 0)
  return { notes: matches.slice(offset, offset + limit), total: matches.length }
}
