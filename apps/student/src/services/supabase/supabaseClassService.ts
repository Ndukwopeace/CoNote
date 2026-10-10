/**
 * The student's classes on Supabase (milestone B2). Row Level Security lets a student read the
 * classes of the courses they are in; this service adds no filter of its own for that.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'

// The class shape.
import type { ClassSession } from '@/types/domain'

// The interface this implementation must satisfy.
import type { ClassService } from '../types'

// Reads and checks rows.
import { readOne, readRows } from './rows'

// The columns of a class the pages show.
const CLASS_COLUMNS =
  'id, course_id, number, title, description, starts_at, ends_at, summary_status'

// SECURITY: a row is checked on arrival, so a stage the app does not know is refused instead of
// reaching a screen.
const classRow = z.object({
  id: z.string(),
  course_id: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  // The database also has 'failed' (the latest AI run failed); see toSession.
  summary_status: z.enum(['collecting', 'processing', 'in_review', 'published', 'failed']),
})

/** One row as the app's ClassSession. */
function toSession(row: z.infer<typeof classRow>): ClassSession {
  const session: ClassSession = {
    id: row.id,
    courseId: row.course_id,
    number: row.number,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    // A failed run is the platform's problem, not the student's: it reads as "still being
    // prepared" until a retry succeeds (the admin console shows the failure).
    summaryStatus: row.summary_status === 'failed' ? 'processing' : row.summary_status,
  }
  // The description is included only when there is one.
  return row.description === null ? session : { ...session, description: row.description }
}

/** The error for a class or course that is missing or that the student may not read. */
function notFound(what: string) {
  // The same answer either way, so it does not reveal which IDs exist.
  return new AppError('not_found', `${what} not found`)
}

/** Builds the Supabase class service. */
export function createSupabaseClassService({ client }: { client: SupabaseClient }): ClassService {
  return {
    async listClasses(courseId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(courseId)) throw notFound('Course')
      // The course and its classes are read together; the course read tells "no classes yet"
      // from "no such course".
      const [course, rows] = await Promise.all([
        readOne(
          client.from('courses').select('id').eq('id', courseId).maybeSingle(),
          z.object({ id: z.string() }),
        ),
        readRows(
          client
            .from('class_sessions')
            .select(CLASS_COLUMNS)
            .eq('course_id', courseId)
            .order('number'),
          classRow,
        ),
      ])
      // Unknown, archived and not-mine courses all read as "not found".
      if (!course) throw notFound('Course')
      return rows.map(toSession)
    },

    async listMyClasses() {
      // Every class of the student's courses, soonest first.
      const rows = await readRows(
        client.from('class_sessions').select(CLASS_COLUMNS).order('starts_at'),
        classRow,
      )
      return rows.map(toSession)
    },

    async getClass(classId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(classId)) throw notFound('Class')
      const row = await readOne(
        client.from('class_sessions').select(CLASS_COLUMNS).eq('id', classId).maybeSingle(),
        classRow,
      )
      // Unknown, archived and not-mine classes all read as "not found".
      if (!row) throw notFound('Class')
      return toSession(row)
    },
  }
}
