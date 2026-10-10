/**
 * The student's notes on Supabase (milestone B2). Notes are private: Row Level Security gives a
 * student their own and nobody else's, administrators and teachers included, so this service adds
 * no author filter of its own. The note rules (lib/notes.ts) are applied here too, so a request
 * that skips the form still meets them.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'

// The note rules shared with the form.
import { noteInputSchema, resolveNoteTitle, type NoteInput } from '@/lib/notes'
// Strips unsafe markup before a note is stored.
import { sanitizeHtml } from '@/lib/sanitizeHtml'
// The note shape.
import type { Note } from '@/types/domain'

// The interface this implementation must satisfy.
import type { NoteFilter, NoteService } from '../types'

// Reads and checks rows.
import { readOne, readRows } from './rows'

// The columns of a note the pages show.
const NOTE_COLUMNS =
  'id, student_id, course_id, class_id, title, content_html, tags, created_at, updated_at'

// SECURITY: rows are checked on arrival, so a field of the wrong shape never reaches a screen.
const noteRow = z.object({
  id: z.string(),
  student_id: z.string(),
  course_id: z.string(),
  class_id: z.string(),
  title: z.string().nullable(),
  content_html: z.string(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
})
// A class, only to learn which course it belongs to.
const classRow = z.object({ id: z.string(), course_id: z.string() })
// What a delete reads back.
const idRow = z.object({ id: z.string() })

// Shown for a class that is not one of the student's, whatever the reason (unknown, hidden, or
// another course's), so the answer reveals nothing about which classes exist.
const CHOOSE_CLASS = 'Choose a class from your courses.'

/** One row as the app's Note. */
function toNote(row: z.infer<typeof noteRow>): Note {
  const note: Note = {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    classId: row.class_id,
    contentHtml: row.content_html,
    tags: row.tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  // The title is included only when there is one.
  return row.title === null ? note : { ...note, title: row.title }
}

/** The error for a note that is missing or that the student may not read. */
function notFound() {
  // The same answer either way, so it does not reveal which notes exist.
  return new AppError('not_found', 'Note not found')
}

/** Builds the Supabase note service. */
export function createSupabaseNoteService({ client }: { client: SupabaseClient }): NoteService {
  /** Checks the input against the note rules; returns the clean values, minus the course. */
  function validate(input: NoteInput) {
    // The shared rules; the first problem becomes the message.
    const parsed = noteInputSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError(
        'validation',
        parsed.error.issues[0]?.message ?? 'Check the note and try again.',
      )
    }
    // SECURITY: markup is cleaned before storage too (defence in depth; SafeHtml still cleans on
    // display), so a stored note never holds scripts or event handlers.
    const contentHtml = sanitizeHtml(parsed.data.contentHtml)
    return {
      classId: parsed.data.classId,
      title: resolveNoteTitle(parsed.data.title, contentHtml),
      contentHtml,
      tags: parsed.data.tags,
    }
  }

  /** The course of class `classId`, or a validation error when it is not one of the student's. */
  async function courseOf(classId: string): Promise<string> {
    // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
    if (!isUuid(classId)) throw new AppError('validation', CHOOSE_CLASS)
    // Row Level Security shows only classes of courses the student is in.
    const session = await readOne(
      client.from('class_sessions').select('id, course_id').eq('id', classId).maybeSingle(),
      classRow,
    )
    if (!session) throw new AppError('validation', CHOOSE_CLASS)
    return session.course_id
  }

  /** The columns written for a note. The author is not among them: the database sets it. */
  function columns(values: ReturnType<typeof validate>, courseId: string) {
    return {
      class_id: values.classId,
      course_id: courseId,
      title: values.title,
      content_html: values.contentHtml,
      tags: values.tags,
    }
  }

  return {
    async listMyNotes(filter: NoteFilter = {}) {
      // SECURITY: a filter that is not a UUID can match nothing, and is not used in a query.
      if (filter.courseId !== undefined && !isUuid(filter.courseId)) return []
      if (filter.classId !== undefined && !isUuid(filter.classId)) return []
      // Newest edit first.
      let query = client
        .from('notes')
        .select(NOTE_COLUMNS)
        .order('updated_at', { ascending: false })
      if (filter.courseId !== undefined) query = query.eq('course_id', filter.courseId)
      if (filter.classId !== undefined) query = query.eq('class_id', filter.classId)
      return (await readRows(query, noteRow)).map(toNote)
    },

    async getNote(noteId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(noteId)) throw notFound()
      const row = await readOne(
        client.from('notes').select(NOTE_COLUMNS).eq('id', noteId).maybeSingle(),
        noteRow,
      )
      // Unknown and not-mine notes both read as "not found".
      if (!row) throw notFound()
      return toNote(row)
    },

    async createNote(input) {
      const values = validate(input)
      const courseId = await courseOf(values.classId)
      try {
        // SECURITY: no author is sent. The database sets it to the signed-in student, and Row
        // Level Security refuses a note in a course the student is not in.
        const row = await readOne(
          client.from('notes').insert(columns(values, courseId)).select(NOTE_COLUMNS).single(),
          noteRow,
        )
        // A successful insert always returns the row.
        if (!row) throw new AppError('unknown', 'Unexpected error')
        return toNote(row)
      } catch (error) {
        // The course closed since the class was read.
        if (error instanceof AppError && error.kind === 'forbidden') {
          throw new AppError('validation', CHOOSE_CLASS, { cause: error })
        }
        throw error
      }
    },

    async updateNote(noteId, input) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(noteId)) throw notFound()
      const values = validate(input)
      const courseId = await courseOf(values.classId)
      // Row Level Security lets a student change only their own notes.
      const rows = await readRows(
        client
          .from('notes')
          .update(columns(values, courseId))
          .eq('id', noteId)
          .select(NOTE_COLUMNS),
        noteRow,
      )
      // Nothing changed: no such note of theirs.
      const row = rows[0]
      if (!row) throw notFound()
      return toNote(row)
    },

    async deleteNote(noteId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(noteId)) throw notFound()
      const removed = await readRows(
        client.from('notes').delete().eq('id', noteId).select('id'),
        idRow,
      )
      // Nothing removed: no such note of theirs.
      if (removed.length === 0) throw notFound()
    },
  }
}
