/**
 * The teacher TeachingService on Supabase (milestone B3.1, D88): the signed-in teacher's courses
 * and their classes. Both lists come from views that show a teacher only the live courses they
 * teach, and count notes without ever returning one, so the portal cannot see what students wrote.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// The shared vocabulary.
// Whether a class is going on now.
import { isInSession, type ClassWindow } from '@conote/core/inSession'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'
// Reads and checks rows.
import { readOne, readRows } from '@conote/supabase/rows'

// The shapes returned.
import type { CourseClass, CourseDetails, TeacherCourse } from '@/types/teaching'

// The interface this implementation must satisfy.
import type { TeachingService } from '../types'

/** What every "no such course" answers, whatever the reason, so the answer reveals nothing. */
const COURSE_NOT_FOUND = "We couldn't find that course."

// SECURITY: each shape is checked on arrival, so a field the app does not know is refused instead
// of reaching a screen. The stored course status is not read: "Ongoing" is worked out from the
// class times (D120).
const courseRow = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  class_count: z.number(),
  waiting_for_review_count: z.number(),
})
// One class's times, to tell whether one is going on.
const windowRow = z.object({ course_id: z.string(), starts_at: z.string(), ends_at: z.string() })
const classRow = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  starts_at: z.string(),
  note_count: z.number(),
  summary_id: z.string().nullable(),
  summary_status: z.enum(['collecting', 'processing', 'in_review', 'published']).nullable(),
  published_at: z.string().nullable(),
})

// The columns of the two views the service reads.
const COURSE_COLUMNS = 'id, code, title, class_count, waiting_for_review_count'
const CLASS_COLUMNS =
  'id, number, title, starts_at, note_count, summary_id, summary_status, published_at'

/** What the service needs. */
interface SupabaseTeachingOptions {
  // The one client the portal uses.
  client: SupabaseClient
  // The clock, so tests can pick the moment; the real one when absent (D120).
  now?: () => Date
}

/** `value` as ISO text with a "Z", whatever form the database wrote it in. */
function iso(value: string): string {
  return new Date(value).toISOString()
}

/** Builds the Supabase TeachingService. */
export function createSupabaseTeachingService({
  client,
  now = () => new Date(),
}: SupabaseTeachingOptions): TeachingService {
  /** SECURITY: nothing is asked of the database without a signed-in session. */
  async function requireSession(message: string): Promise<void> {
    const { data } = await client.auth.getSession()
    if (!data.session) throw new AppError('unauthorized', message)
  }

  /**
   * The times of the classes in use of the courses `ids`, by course. Row Level Security lets a
   * teacher read the classes of their own courses, so nothing else can come back.
   */
  async function classTimes(ids: readonly string[]): Promise<Map<string, ClassWindow[]>> {
    const byCourse = new Map<string, ClassWindow[]>()
    // Nothing to ask for.
    if (ids.length === 0) return byCourse
    const rows = await readRows(
      client
        .from('class_sessions')
        .select('course_id, starts_at, ends_at')
        .in('course_id', ids)
        .is('archived_at', null),
      windowRow,
    )
    for (const row of rows) {
      const windows = byCourse.get(row.course_id) ?? []
      windows.push({ startsAt: row.starts_at, endsAt: row.ends_at })
      byCourse.set(row.course_id, windows)
    }
    return byCourse
  }

  return {
    async listMyCourses() {
      await requireSession('Sign in to see your courses.')
      // The view shows only this teacher's live courses.
      const rows = await readRows(client.from('teacher_courses').select(COURSE_COLUMNS), courseRow)
      // When each course has a class going on.
      const times = await classTimes(rows.map((row) => row.id))
      // One moment for every course in this answer.
      const at = now()
      return (
        rows
          .map((row): TeacherCourse => ({
            id: row.id,
            code: row.code,
            title: row.title,
            inSession: isInSession(times.get(row.id) ?? [], at),
            classCount: row.class_count,
            waitingForReviewCount: row.waiting_for_review_count,
          }))
          // A course with a class going on comes first, then by code.
          .toSorted(
            (a, b) => Number(b.inSession) - Number(a.inSession) || a.code.localeCompare(b.code),
          )
      )
    },

    async getMyCourse(courseId) {
      await requireSession('Sign in to see this course.')
      // SECURITY: an ID that is not a UUID never reaches a query. It answers like any other
      // course that is not the teacher's.
      if (!isUuid(courseId)) throw new AppError('not_found', COURSE_NOT_FOUND)
      // SECURITY: another teacher's, an archived and an unknown course all give no row, so a
      // teacher can't find out which course IDs exist.
      const course = await readOne(
        client.from('teacher_courses').select(COURSE_COLUMNS).eq('id', courseId).maybeSingle(),
        courseRow,
      )
      if (!course) throw new AppError('not_found', COURSE_NOT_FOUND)
      // The classes in use, newest first (the highest number is the latest).
      const classes = await readRows(
        client
          .from('teacher_classes')
          .select(CLASS_COLUMNS)
          .eq('course_id', course.id)
          .order('number', { ascending: false }),
        classRow,
      )
      return {
        id: course.id,
        code: course.code,
        title: course.title,
        inSession: isInSession((await classTimes([course.id])).get(course.id) ?? [], now()),
        classes: classes.map((row): CourseClass => ({
          id: row.id,
          number: row.number,
          title: row.title,
          startsAt: iso(row.starts_at),
          noteCount: row.note_count,
          summaryId: row.summary_id,
          // A class with no summary yet is still collecting notes.
          stage: row.summary_status ?? 'collecting',
          publishedAt: row.published_at === null ? null : iso(row.published_at),
        })),
      } satisfies CourseDetails
    },
  }
}
