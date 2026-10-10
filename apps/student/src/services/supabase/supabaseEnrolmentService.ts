/**
 * Asking to join courses on Supabase (milestone B2, FR-ENR, D76). The student reads the courses
 * in use through the `joinable_courses` view, and creates and cancels their own requests in
 * `enrollment_requests`. Row Level Security is what limits them to their own requests; approving
 * happens in the admin console (the `decide_enrollment_request` function).
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'

// The shapes the service returns.
import type { JoinableCourse, JoinRequest } from '@/types/domain'

// The interface this implementation must satisfy.
import type { EnrolmentService } from '../types'

// Reads and checks rows.
import { readOne, readRows } from '@conote/supabase/rows'

// The columns of the view the join dialog lists.
const JOINABLE_COLUMNS = 'id, code, title, status, teacher_name, membership'
// The columns of a request the service reads back.
const REQUEST_COLUMNS = 'id, course_id, status, created_at'

// SECURITY: each shape is checked on arrival, so a standing or status the app does not know is
// refused instead of reaching a screen.
const joinableRow = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  status: z.enum(['upcoming', 'ongoing', 'completed']),
  teacher_name: z.string().nullable(),
  // The view knows three standings; "declined" comes from the student's latest request.
  membership: z.enum(['none', 'pending', 'enrolled']),
})
// One of the student's own requests.
const requestRow = z.object({
  id: z.string(),
  course_id: z.string(),
  status: z.enum(['pending', 'approved', 'declined', 'cancelled']),
  created_at: z.string(),
})
// What cancelling reads back.
const idRow = z.object({ id: z.string() })

// Shown for a course that cannot take a request, whatever the reason (unknown, archived or
// completed), so the answer reveals nothing about which course IDs exist.
const NOT_OPEN = "This course isn't open for requests."
// Shown when the student asks for a course they already asked for.
const ALREADY_ASKED = "You've already asked to join this course."
// Shown for a course the student is already in.
const ALREADY_IN = "You're already in this course."
// Shown for a course with no teacher.
const NO_TEACHER = 'Not assigned yet'

type JoinableRow = z.infer<typeof joinableRow>
type RequestRow = z.infer<typeof requestRow>

/** The newest request for each course. `rows` must be newest first. */
function latestByCourse(rows: readonly RequestRow[]): Map<string, RequestRow> {
  const latest = new Map<string, RequestRow>()
  for (const row of rows) {
    // The first row seen for a course is its newest.
    if (!latest.has(row.course_id)) latest.set(row.course_id, row)
  }
  return latest
}

/** A request as the student sees it, with its course's code and title. */
function toJoinRequest(
  row: RequestRow,
  course: JoinableRow,
  status: 'pending' | 'declined',
): JoinRequest {
  return {
    id: row.id,
    courseId: row.course_id,
    courseCode: course.code,
    courseTitle: course.title,
    status,
    createdAt: row.created_at,
  }
}

/** Builds the Supabase enrolment service. */
export function createSupabaseEnrolmentService({
  client,
}: {
  client: SupabaseClient
}): EnrolmentService {
  /** The student's own requests, newest first (Row Level Security limits them to their own). */
  function readMyRequests() {
    return readRows(
      client
        .from('enrollment_requests')
        .select(REQUEST_COLUMNS)
        .order('created_at', { ascending: false }),
      requestRow,
    )
  }

  /** The courses in use, in code order. */
  function readJoinable() {
    return readRows(
      client.from('joinable_courses').select(JOINABLE_COLUMNS).order('code'),
      joinableRow,
    )
  }

  return {
    async listJoinableCourses(query = '') {
      const [courses, requests] = await Promise.all([readJoinable(), readMyRequests()])
      const latest = latestByCourse(requests)
      // SECURITY: the search runs here, on rows already fetched. Typed text is never put into a
      // query, where characters such as commas and brackets could be read as filter syntax.
      const needle = query.trim().toLowerCase()
      return courses
        .filter(
          (course) =>
            needle === '' ||
            course.code.toLowerCase().includes(needle) ||
            course.title.toLowerCase().includes(needle),
        )
        .map((course): JoinableCourse => {
          const request = latest.get(course.id)
          // The view says "enrolled" or "pending"; otherwise a declined latest request shows.
          let membership: JoinableCourse['membership'] = course.membership
          if (membership === 'none' && request?.status === 'declined') membership = 'declined'
          return {
            id: course.id,
            code: course.code,
            title: course.title,
            teacherName: course.teacher_name ?? NO_TEACHER,
            status: course.status,
            membership,
            // Only a waiting request can be cancelled.
            requestId: membership === 'pending' && request ? request.id : null,
          }
        })
    },

    async listMyJoinRequests() {
      const [courses, requests] = await Promise.all([readJoinable(), readMyRequests()])
      const byId = new Map(courses.map((course) => [course.id, course]))
      const shown: JoinRequest[] = []
      // Newest first, and only each course's latest request, if still pending or declined.
      for (const row of latestByCourse(requests).values()) {
        const course = byId.get(row.course_id)
        // A course no longer in use cannot be named or acted on, so its request is left out.
        if (!course) continue
        if (row.status === 'pending' || row.status === 'declined') {
          shown.push(toJoinRequest(row, course, row.status))
        }
      }
      // The map keeps first-seen order, which is newest first; sort anyway so it is explicit.
      return shown.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    },

    async requestToJoin(courseId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(courseId)) throw new AppError('validation', NOT_OPEN)
      // The course as the student can see it: only courses in use are in the view.
      const course = await readOne(
        client.from('joinable_courses').select(JOINABLE_COLUMNS).eq('id', courseId).maybeSingle(),
        joinableRow,
      )
      // Unknown, archived and completed courses all answer the same.
      if (!course) throw new AppError('validation', NOT_OPEN)
      if (course.membership === 'enrolled') throw new AppError('conflict', ALREADY_IN)
      if (course.membership === 'pending') throw new AppError('conflict', ALREADY_ASKED)
      try {
        // SECURITY: only the course is sent. The database fills in the signed-in student, and
        // Row Level Security refuses anything else (another student, a status other than pending).
        const created = await readOne(
          client
            .from('enrollment_requests')
            .insert({ course_id: courseId })
            .select(REQUEST_COLUMNS)
            .single(),
          requestRow,
        )
        // A successful insert always returns the row.
        if (!created) throw new AppError('unknown', 'Unexpected error')
        return toJoinRequest(created, course, 'pending')
      } catch (error) {
        // Another tab asked first.
        if (error instanceof AppError && error.kind === 'conflict') {
          throw new AppError('conflict', ALREADY_ASKED, { cause: error })
        }
        // The course closed since it was read.
        if (error instanceof AppError && error.kind === 'forbidden') {
          throw new AppError('validation', NOT_OPEN, { cause: error })
        }
        throw error
      }
    },

    async cancelJoinRequest(requestId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(requestId)) throw new AppError('not_found', 'Request not found')
      // Only a pending request of the student's own can change (the policy checks both again).
      const changed = await readRows(
        client
          .from('enrollment_requests')
          .update({ status: 'cancelled' })
          .eq('id', requestId)
          .eq('status', 'pending')
          .select('id'),
        idRow,
      )
      if (changed.length > 0) return
      // Nothing changed: either there is no such request of theirs, or it was already decided.
      const existing = await readOne(
        client.from('enrollment_requests').select('id, status').eq('id', requestId).maybeSingle(),
        idRow.extend({ status: z.string() }),
      )
      if (!existing) throw new AppError('not_found', 'Request not found')
      throw new AppError('conflict', 'This request has already been decided.')
    },
  }
}
