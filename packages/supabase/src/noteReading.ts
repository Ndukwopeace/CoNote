/**
 * Reading students' notes on Supabase, for the teacher and admin apps (D123). The table itself
 * stays closed to both; they read through two database functions, `search_notes` and
 * `class_note_roster`. Each function checks who is asking (an active administrator, or an active
 * teacher for the courses they teach), refuses everyone else, and writes every use to the audit
 * log. This module only sends the questions and checks the answers.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// The shapes shared with the demo data.
import {
  NOTES_PAGE_SIZE,
  type NoteEntry,
  type NotePage,
  type NoteReadingService,
  type NoteRosterEntry,
  type NoteSearchQuery,
} from '@conote/core/noteReading'

// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from './ids'
// Reads and checks rows; a refusal becomes an AppError.
import { readRows } from './rows'

// SECURITY: rows are checked on arrival, so a field the app does not know is refused, not shown.
const noteRow = z.object({
  note_id: z.string(),
  class_id: z.string(),
  class_number: z.number(),
  class_title: z.string(),
  course_id: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  student_id: z.string(),
  student_name: z.string(),
  student_number: z.string().nullable(),
  note_title: z.string().nullable(),
  content_html: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  total_count: z.number(),
})
const rosterRow = z.object({
  student_id: z.string(),
  student_name: z.string(),
  student_number: z.string().nullable(),
  note_count: z.number(),
})

/** One database row as a note. */
function toEntry(row: z.infer<typeof noteRow>): NoteEntry {
  return {
    id: row.note_id,
    classId: row.class_id,
    classNumber: row.class_number,
    classTitle: row.class_title,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    studentId: row.student_id,
    studentName: row.student_name,
    studentNumber: row.student_number,
    title: row.note_title,
    contentHtml: row.content_html,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Builds the note reader over a signed-in client. */
export function createSupabaseNoteReader({
  client,
}: {
  client: SupabaseClient
}): NoteReadingService {
  return {
    async searchNotes(query: NoteSearchQuery): Promise<NotePage> {
      // SECURITY: an ID that is not a UUID is turned away before it is sent.
      for (const id of [query.courseId, query.classId, query.studentId]) {
        if (id !== undefined && !isUuid(id)) {
          throw new AppError('validation', 'That search is not valid.')
        }
      }
      // A refusal (not a teacher or administrator, or a bad search) becomes an AppError, and a row
      // of the wrong shape is refused rather than shown.
      const rows = await readRows(
        client.rpc('search_notes', {
          p_course: query.courseId ?? null,
          p_class: query.classId ?? null,
          p_student_id: query.studentId ?? null,
          p_student_text: query.studentText ?? null,
          p_limit: query.limit ?? NOTES_PAGE_SIZE,
          p_offset: query.offset ?? 0,
        }),
        noteRow,
      )
      // The total is the same on every row; with no rows there is nothing to count.
      return { notes: rows.map(toEntry), total: rows[0]?.total_count ?? 0 }
    },

    async getNoteRoster(classId: string): Promise<NoteRosterEntry[]> {
      // SECURITY: a malformed ID answers like an unknown class, so nothing is revealed.
      if (!isUuid(classId)) throw new AppError('not_found', 'We could not find that.')
      const rows = await readRows(client.rpc('class_note_roster', { p_class: classId }), rosterRow)
      return rows.map((row) => ({
        studentId: row.student_id,
        studentName: row.student_name,
        studentNumber: row.student_number,
        noteCount: row.note_count,
      }))
    },
  }
}
