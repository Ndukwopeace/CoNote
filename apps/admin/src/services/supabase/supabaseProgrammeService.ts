/**
 * The admin ProgrammeService on Supabase (D105): the programme list (a view only administrators
 * can read), opening and closing enrolment, and the timetable import, which is one database
 * function so it succeeds or fails as a whole. Row Level Security and the function's own check
 * keep everyone but an administrator out; the service adds clear messages and the same answers as
 * the demo service (the contract suite runs against both).
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Errors from the database, with the code and message the rules below rely on.
import { databaseCode, databaseMessage } from '@conote/supabase/databaseErrors'
import { fromSupabaseError } from '@conote/supabase/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'
// Reads and checks rows.
import { readRows } from '@conote/supabase/rows'

// Programme shapes.
import type {
  ImportOutcome,
  ProgrammeListItem,
  ProgrammeMember,
  ProgrammeRequestItem,
} from '@/types/programmes'

// The interface this implementation must satisfy.
import type { ProgrammeService } from '../types'

/** The columns the list view returns. */
const COLUMNS = 'id, code, name, open_enrolment, course_count, student_count, pending_request_count'
/** The columns of the waiting-requests view. */
const REQUEST_COLUMNS =
  'id, created_at, programme_id, programme_code, programme_name, student_id, student_name, student_email'
/** The columns of the members view. */
const MEMBER_COLUMNS = 'student_id, student_name, student_email'
/** What an unusable teacher gets told. */
const TEACHER_MESSAGE = 'Choose an active teacher.'
/** What a file that breaks the rules gets told, with the database's reason after it. */
const PAYLOAD_MESSAGE = "The timetable can't be imported: "

// SECURITY: each shape is checked on arrival, so a row of the wrong shape never reaches a screen.
const programmeRow = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  open_enrolment: z.boolean(),
  course_count: z.number(),
  student_count: z.number(),
  pending_request_count: z.number(),
})
/** A waiting request, with who asked and for what. */
const requestRow = z.object({
  id: z.string(),
  created_at: z.string(),
  programme_id: z.string(),
  programme_code: z.string(),
  programme_name: z.string(),
  student_id: z.string(),
  student_name: z.string(),
  student_email: z.string(),
})
/** A student in a programme. */
const memberRow = z.object({
  student_id: z.string(),
  student_name: z.string(),
  student_email: z.string(),
})
/** What removing a student answers with: how many courses they left. */
const countRow = z.number().int().nonnegative()
/** What the import function answers with. */
const outcomeRow = z.object({
  programmesCreated: z.number(),
  programmesExisting: z.number(),
  coursesCreated: z.number(),
  coursesExisting: z.number(),
  classesCreated: z.number(),
  classesSkipped: z.number(),
  teachersAssigned: z.number(),
})
/** An ID alone. */
const idRow = z.object({ id: z.string() })

/** A list row as the screens use it. */
function toItem(row: z.infer<typeof programmeRow>): ProgrammeListItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    openEnrolment: row.open_enrolment,
    courseCount: row.course_count,
    studentCount: row.student_count,
    pendingRequestCount: row.pending_request_count,
  }
}

/** Builds the Supabase programme service. */
export function createSupabaseProgrammeService({
  client,
}: {
  client: SupabaseClient
}): ProgrammeService {
  /** SECURITY: no change is attempted without a signed-in session. */
  async function requireSession(): Promise<void> {
    const { data } = await client.auth.getSession()
    if (!data.session) throw new AppError('unauthorized', 'Sign in again to continue.')
  }

  /** Every programme, A to Z by code regardless of letter case. */
  async function readAll(): Promise<ProgrammeListItem[]> {
    const rows = await readRows(
      client.from('admin_programmes').select(COLUMNS).order('code'),
      programmeRow,
    )
    return rows
      .map(toItem)
      .sort((a, b) => a.code.localeCompare(b.code, 'en', { sensitivity: 'base' }))
  }

  return {
    listProgrammes() {
      return readAll()
    },

    async setEnrolmentOpen(programmeId, open) {
      await requireSession()
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(programmeId)) throw new AppError('not_found', 'Programme not found.')
      const changed = await readRows(
        client
          .from('programmes')
          .update({ open_enrolment: open })
          .eq('id', programmeId)
          .select('id'),
        idRow,
      )
      // Row Level Security hides rows silently, so "nothing changed" means no such programme.
      if (changed.length === 0) throw new AppError('not_found', 'Programme not found.')
      const found = (await readAll()).find((programme) => programme.id === programmeId)
      if (!found) throw new AppError('not_found', 'Programme not found.')
      return found
    },

    async listProgrammeRequests() {
      const rows = await readRows(
        client
          .from('admin_programme_requests')
          .select(REQUEST_COLUMNS)
          .eq('status', 'pending')
          .order('created_at'),
        requestRow,
      )
      return rows.map((row): ProgrammeRequestItem => ({
        id: row.id,
        programmeId: row.programme_id,
        programmeCode: row.programme_code,
        programmeName: row.programme_name,
        studentId: row.student_id,
        studentName: row.student_name,
        studentEmail: row.student_email,
        createdAt: row.created_at,
      }))
    },

    async decideProgrammeRequest(requestId, decision) {
      await requireSession()
      // SECURITY: an ID that is not a UUID is turned away before it reaches the database.
      if (!isUuid(requestId)) throw new AppError('not_found', 'Request not found.')
      // The database function checks the caller is an administrator, locks the request so two
      // administrators cannot both decide it, and does the enrolling in one transaction.
      const { error } = (await client.rpc('decide_programme_request', {
        p_request: requestId,
        p_decision: decision,
      })) as { error: unknown }
      if (!error) return
      const code = databaseCode(error)
      if (code === 'P0002') throw new AppError('not_found', 'Request not found.', { cause: error })
      if (code === '23505') {
        // Decided already, or the student has joined a programme since.
        const inProgramme = databaseMessage(error).includes('already in a programme')
        throw new AppError(
          'conflict',
          inProgramme
            ? 'This student is already in a programme.'
            : 'This request has already been decided.',
          { cause: error },
        )
      }
      if (code === '23514') {
        throw new AppError('validation', 'This programme is archived.', { cause: error })
      }
      if (code === '22023') {
        throw new AppError('validation', "This account can't join a programme.", { cause: error })
      }
      throw fromSupabaseError(error)
    },

    async listProgrammeMembers(programmeId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(programmeId)) return []
      const rows = await readRows(
        client
          .from('admin_programme_members')
          .select(MEMBER_COLUMNS)
          .eq('programme_id', programmeId)
          .order('student_name'),
        memberRow,
      )
      return rows.map((row): ProgrammeMember => ({
        studentId: row.student_id,
        studentName: row.student_name,
        studentEmail: row.student_email,
      }))
    },

    async removeFromProgramme(studentId) {
      await requireSession()
      // SECURITY: an ID that is not a UUID is turned away before it reaches the database.
      if (!isUuid(studentId)) throw new AppError('not_found', "This student isn't in a programme.")
      const { data, error } = (await client.rpc('remove_from_programme', {
        p_student: studentId,
      })) as { data: unknown; error: unknown }
      if (error) {
        if (databaseCode(error) === 'P0002') {
          throw new AppError('not_found', "This student isn't in a programme.", { cause: error })
        }
        throw fromSupabaseError(error)
      }
      // SECURITY: the answer is checked like any row.
      const parsed = countRow.safeParse(data)
      if (!parsed.success) {
        throw fromSupabaseError({ message: 'Malformed row', cause: parsed.error })
      }
      return parsed.data
    },

    async importTimetable(payload, { dryRun }) {
      await requireSession()
      // The database function checks the caller, the payload and every rule, and does it all in
      // one transaction.
      const { data, error } = (await client.rpc('import_timetable', {
        p_payload: payload,
        p_dry_run: dryRun,
      })) as { data: unknown; error: unknown }
      if (error) {
        const code = databaseCode(error)
        // An inactive or non-teacher account was named as a teacher.
        if (code === '23514') throw new AppError('validation', TEACHER_MESSAGE, { cause: error })
        // The payload broke a rule; the function's own words say which.
        if (code === '22023') {
          throw new AppError('validation', `${PAYLOAD_MESSAGE}${databaseMessage(error)}.`, {
            cause: error,
          })
        }
        throw fromSupabaseError(error)
      }
      // SECURITY: the answer is checked like any row.
      const parsed = outcomeRow.safeParse(data)
      if (!parsed.success)
        throw fromSupabaseError({ message: 'Malformed row', cause: parsed.error })
      const outcome: ImportOutcome = parsed.data
      return outcome
    },
  }
}
