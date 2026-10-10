/**
 * The admin CourseService on Supabase (milestone B2.6, D84): courses, their students and the
 * students' requests to join. The console is an administrator's; Row Level Security lets only an
 * administrator read the list view or write these tables, so every rule here is also held by the
 * database. The service adds what a form needs: tidy input, clear messages, and the same answers
 * as the demo service (the contract suite runs against both).
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'
// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { fromSupabaseError } from '@conote/supabase/errors'
import { isUuid } from '@conote/supabase/ids'
// Reads and checks rows.
import { readOne, readRows } from '@conote/supabase/rows'

// The form rules, enforced here too.
import { courseSchema } from '@/lib/courseSchemas'
// Course shapes.
import type {
  CourseDetails,
  CourseFilter,
  CourseListItem,
  CourseSort,
  EnrolledStudent,
  EnrollmentMatch,
  EnrollmentRequest,
  UnmatchedReason,
} from '@/types/courses'

// The interface this implementation must satisfy.
import type { CourseService } from '../types'

// Search text, times and names.
import { compareText, iso, safeSearch } from './queryText'
// Errors from the database, with the code and message the rules above rely on.
import { databaseCode, databaseMessage } from './databaseErrors'

/** How many courses a page holds. */
const PAGE_SIZE = 20

/** What an archived course says to every change. */
const ARCHIVED_MESSAGE = 'This course is archived. Restore it to make changes.'
/** What an unusable teacher gets told. */
const TEACHER_MESSAGE = 'Choose an active teacher.'
/** What a request from an account that can't be enrolled gets told. */
const CANNOT_ENROL_MESSAGE = "This account can't be enrolled."

// The columns of the list view the service reads.
const COURSE_COLUMNS =
  'id, code, title, description, department, status, created_at, archived_at, teacher_id, teacher_name, student_count, class_count, pending_request_count'
// The columns of a person the enrolment screens show.
const PERSON_COLUMNS = 'id, full_name, email, student_number, status'

// SECURITY: each shape is checked on arrival, so a status or role the app does not know is refused
// instead of reaching a screen.
const courseRow = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  department: z.string().nullable(),
  status: z.enum(['upcoming', 'ongoing', 'completed']),
  created_at: z.string(),
  archived_at: z.string().nullable(),
  teacher_id: z.string().nullable(),
  teacher_name: z.string().nullable(),
  student_count: z.number(),
  class_count: z.number(),
  pending_request_count: z.number(),
})
// A person in a course or a request.
const personRow = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string(),
  student_number: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']),
})
// A person the bulk lookup found.
const matchRow = personRow.extend({ role: z.enum(['student', 'teacher', 'admin']) })
// A class as the course's tab shows it.
const classRow = z.object({
  id: z.string(),
  title: z.string(),
  starts_at: z.string(),
  archived_at: z.string().nullable(),
})
// A class's summary stage, from the monitoring view (an administrator never reads draft text).
const stageRow = z.object({
  class_id: z.string(),
  status: z.enum(['collecting', 'processing', 'in_review', 'published', 'failed']),
})
// A resource as the course's tab shows it.
const resourceRow = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['pdf', 'document', 'slides', 'video', 'link']),
  status: z.enum(['draft', 'published', 'archived']),
  // The class it belongs to, when it belongs to one.
  class: z.object({ title: z.string() }).nullable(),
})
// A department, from the departments view.
const departmentRow = z.object({ department: z.string() })
// A teacher the picker offers.
const teacherRow = z.object({
  id: z.string(),
  full_name: z.string(),
  department: z.string().nullable(),
})
// A waiting request with the student who asked.
const requestRow = z.object({
  id: z.string(),
  created_at: z.string(),
  student: personRow.nullable(),
})
// What an insert reads back.
const idRow = z.object({ id: z.string() })
// A student's ID, from the enrolment table.
const studentIdRow = z.object({ student_id: z.string() })

type CourseRow = z.infer<typeof courseRow>
type PersonRow = z.infer<typeof personRow>

/** What the service needs. */
interface SupabaseCourseOptions {
  // The one client the console uses.
  client: SupabaseClient
  // The clock, for the time a course is archived. Tests set it; the app uses the real one.
  now?: () => Date
}

/** The course as a list row. */
function toListItem(row: CourseRow): CourseListItem {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    department: row.department,
    status: row.status,
    teacher:
      row.teacher_id === null ? null : { id: row.teacher_id, fullName: row.teacher_name ?? '' },
    studentCount: row.student_count,
    classCount: row.class_count,
    pendingRequestCount: row.pending_request_count,
    archivedAt: row.archived_at === null ? null : iso(row.archived_at),
  }
}

/** The person as the enrolment screens show them. */
function toStudent(row: PersonRow): EnrolledStudent {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    studentNumber: row.student_number,
    status: row.status,
  }
}

/** Throws the validation error a form shows if `value` breaks the course rules. */
function parseCourse(value: unknown) {
  const result = courseSchema.safeParse(value)
  if (!result.success) {
    throw new AppError('validation', result.error.issues[0]?.message ?? 'Check the details.')
  }
  return result.data
}

/** Builds the Supabase CourseService. */
export function createSupabaseCourseService({
  client,
  now = () => new Date(),
}: SupabaseCourseOptions): CourseService {
  /** The filtered list query; `head` asks only for the count. */
  function listQuery(filter: CourseFilter, columns: string, head: boolean) {
    // Count every match, whichever page is asked for.
    let query = client.from('admin_courses').select(columns, { count: 'exact', head })
    // In use, or archived.
    query = filter.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.department) query = query.eq('department', filter.department)
    // A teacher's ID, or "none" for courses without one.
    if (filter.teacher === 'none') query = query.is('teacher_id', null)
    else if (filter.teacher) query = query.eq('teacher_id', filter.teacher)
    if (filter.requests) query = query.gt('pending_request_count', 0)
    const q = safeSearch(filter.q)
    if (q) query = query.or(`code.ilike.%${q}%,title.ilike.%${q}%`)
    return query
  }

  /** One course's list row, or not_found. */
  async function findRow(courseId: string): Promise<CourseRow> {
    // SECURITY: an ID that is not a UUID never reaches a query.
    if (!isUuid(courseId)) throw new AppError('not_found', 'Course not found.')
    const row = await readOne(
      client.from('admin_courses').select(COURSE_COLUMNS).eq('id', courseId).maybeSingle(),
      courseRow,
    )
    if (!row) throw new AppError('not_found', 'Course not found.')
    return row
  }

  /** SECURITY: no change is attempted without a signed-in session. */
  async function requireSession(): Promise<void> {
    const { data } = await client.auth.getSession()
    if (!data.session) throw new AppError('unauthorized', 'Sign in again to continue.')
  }

  /** The course to change: it exists and is in use. */
  async function findInUse(courseId: string): Promise<CourseRow> {
    const row = await findRow(courseId)
    // An archived course refuses changes until it is restored.
    if (row.archived_at !== null) throw new AppError('validation', ARCHIVED_MESSAGE)
    return row
  }

  /** Turns a refused write into the message the form shows. */
  function writeError(error: unknown): AppError {
    const code = databaseCode(error)
    if (code === '23505') return new AppError('conflict', 'A course with this code already exists.')
    if (code === '23514') return new AppError('validation', TEACHER_MESSAGE)
    return fromSupabaseError(error)
  }

  /** Waits for a write; a refusal becomes the message the form shows. */
  async function write(query: PromiseLike<{ error: unknown }>): Promise<void> {
    const { error } = await query
    if (error) throw writeError(error)
  }

  /** The details page for the course in `row`. */
  async function toDetails(row: CourseRow): Promise<CourseDetails> {
    // The course's classes (oldest first) and resources (oldest first), read together.
    const [classes, resources] = await Promise.all([
      readRows(
        client
          .from('class_sessions')
          .select('id, title, starts_at, archived_at')
          .eq('course_id', row.id)
          .order('starts_at'),
        classRow,
      ),
      readRows(
        client
          .from('resources')
          .select('id, title, type, status, class:class_sessions!class_id(title)')
          .eq('course_id', row.id)
          .order('created_at'),
        resourceRow,
      ),
    ])
    // Each class's summary stage, where it has a summary.
    const stages = new Map<string, SummaryStatus>()
    if (classes.length > 0) {
      const found = await readRows(
        client
          .from('summary_monitor')
          .select('class_id, status')
          .in(
            'class_id',
            classes.map((item) => item.id),
          ),
        stageRow,
      )
      for (const stage of found) {
        // A failed run counts as still processing, as the student sees it; the domain has no "failed".
        stages.set(stage.class_id, stage.status === 'failed' ? 'processing' : stage.status)
      }
    }
    // The stage of a class, or null before it has a summary.
    const stageOf = (classId: string) => stages.get(classId) ?? null
    return {
      ...toListItem(row),
      description: row.description,
      createdAt: iso(row.created_at),
      publishedSummaryCount: classes.filter((item) => stageOf(item.id) === 'published').length,
      classes: classes.map((item) => ({
        id: item.id,
        title: item.title,
        startsAt: iso(item.starts_at),
        summaryStatus: stageOf(item.id),
        archived: item.archived_at !== null,
      })),
      resources: resources.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        classTitle: item.class?.title ?? null,
      })),
    }
  }

  /** The IDs of the students in a course. */
  async function enrolledIds(courseId: string): Promise<Set<string>> {
    const rows = await readRows(
      client.from('enrollments').select('student_id').eq('course_id', courseId),
      studentIdRow,
    )
    return new Set(rows.map((row) => row.student_id))
  }

  return {
    async listCourses(filter) {
      // SECURITY: a teacher ID that is not a UUID matches nothing and never reaches a query.
      if (filter.teacher && filter.teacher !== 'none' && !isUuid(filter.teacher)) {
        return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE }
      }
      // How many courses match, so a page past the end can show the last page instead.
      const counted = await listQuery(filter, 'id', true)
      if (counted.error) throw fromSupabaseError(counted.error)
      const total = counted.count ?? 0
      const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
      const page = Math.min(Math.max(1, filter.page ?? 1), lastPage)
      // The sort: a field, "-" in front for descending, ties by code.
      const sort: CourseSort = filter.sort ?? 'code'
      const descending = sort.startsWith('-')
      const field = descending ? sort.slice(1) : sort
      const column = field === 'students' ? 'student_count' : field === 'title' ? 'title' : 'code'
      const start = (page - 1) * PAGE_SIZE
      let query = listQuery(filter, COURSE_COLUMNS, false).order(column, { ascending: !descending })
      if (column !== 'code') query = query.order('code')
      // Past the last row there is nothing to ask for.
      const rows =
        total === 0 ? [] : await readRows(query.range(start, start + PAGE_SIZE - 1), courseRow)
      return { items: rows.map(toListItem), total, page, pageSize: PAGE_SIZE }
    },

    async listCourseFilterOptions() {
      const [departments, teachers] = await Promise.all([
        readRows(client.from('admin_departments').select('department'), departmentRow),
        readRows(
          client
            .from('profiles')
            .select('id, full_name, department')
            .eq('role', 'teacher')
            .eq('status', 'active'),
          teacherRow,
        ),
      ])
      return {
        departments: departments.map((row) => row.department).sort(compareText),
        teachers: teachers
          .map((row) => ({ id: row.id, fullName: row.full_name, department: row.department }))
          .sort((a, b) => compareText(a.fullName, b.fullName)),
      }
    },

    async getCourse(courseId) {
      return toDetails(await findRow(courseId))
    },

    async createCourse(input) {
      await requireSession()
      const values = parseCourse(input)
      // SECURITY: a teacher ID that is not a UUID never reaches a query.
      if (values.teacherId !== null && !isUuid(values.teacherId)) {
        throw new AppError('validation', TEACHER_MESSAGE)
      }
      const { error, data } = await client
        .from('courses')
        .insert({
          code: values.code,
          title: values.title,
          description: values.description,
          department: values.department,
          status: values.status,
          teacher_id: values.teacherId,
        })
        .select('id')
        .single()
      if (error) throw writeError(error)
      const created = idRow.parse(data)
      return toDetails(await findRow(created.id))
    },

    async updateCourse(courseId, input) {
      await requireSession()
      const row = await findInUse(courseId)
      const values = parseCourse(input)
      if (values.teacherId !== null && !isUuid(values.teacherId)) {
        throw new AppError('validation', TEACHER_MESSAGE)
      }
      // A teacher who has since been deactivated may stay; the database checks only a change.
      await write(
        client
          .from('courses')
          .update({
            code: values.code,
            title: values.title,
            description: values.description,
            department: values.department,
            status: values.status,
            teacher_id: values.teacherId,
          })
          .eq('id', row.id),
      )
      return toDetails(await findRow(row.id))
    },

    async archiveCourse(courseId) {
      await requireSession()
      const row = await findRow(courseId)
      if (row.archived_at !== null) {
        throw new AppError('validation', 'This course is already archived.')
      }
      // Take it out of use; its classes, notes and students stay.
      await write(
        client.from('courses').update({ archived_at: now().toISOString() }).eq('id', row.id),
      )
      return toDetails(await findRow(row.id))
    },

    async restoreCourse(courseId) {
      await requireSession()
      const row = await findRow(courseId)
      if (row.archived_at === null) {
        throw new AppError('validation', 'This course is not archived.')
      }
      await write(client.from('courses').update({ archived_at: null }).eq('id', row.id))
      return toDetails(await findRow(row.id))
    },

    async assignTeacher(courseId, teacherId) {
      await requireSession()
      const row = await findInUse(courseId)
      if (!isUuid(teacherId)) throw new AppError('validation', TEACHER_MESSAGE)
      await write(client.from('courses').update({ teacher_id: teacherId }).eq('id', row.id))
      return toDetails(await findRow(row.id))
    },

    async removeTeacher(courseId) {
      await requireSession()
      const row = await findInUse(courseId)
      // Nobody to remove: nothing changes.
      if (row.teacher_id === null) return toDetails(row)
      await write(client.from('courses').update({ teacher_id: null }).eq('id', row.id))
      return toDetails(await findRow(row.id))
    },

    async listEnrollments(courseId, q) {
      const course = await findRow(courseId)
      const rows = await readRows(
        client
          .from('enrollments')
          .select(`student:profiles!student_id(${PERSON_COLUMNS})`)
          .eq('course_id', course.id),
        z.object({ student: personRow.nullable() }),
      )
      const query = q?.trim().toLowerCase()
      return rows
        .flatMap((row) => (row.student ? [row.student] : []))
        .filter(
          (student) =>
            !query ||
            [student.full_name, student.email, student.student_number].some((field) =>
              field?.toLowerCase().includes(query),
            ),
        )
        .map(toStudent)
        .sort((a, b) => compareText(a.fullName, b.fullName))
    },

    async matchStudents(courseId, identifiers) {
      const course = await findRow(courseId)
      // The people these values name, in any letter case.
      const values = identifiers.map((value) => value.trim()).filter((value) => value !== '')
      const people =
        values.length === 0
          ? []
          : await readRows(client.rpc('admin_match_people', { p_identifiers: values }), matchRow)
      const byKey = new Map<string, z.infer<typeof matchRow>>()
      for (const person of people) {
        byKey.set(person.email.toLowerCase(), person)
        if (person.student_number) byKey.set(person.student_number.toLowerCase(), person)
      }
      const enrolled = await enrolledIds(course.id)
      // Sort each value; a person reached twice is listed once.
      const result: EnrollmentMatch = { matched: [], alreadyEnrolled: [], unmatched: [] }
      const seen = new Set<string>()
      for (const value of identifiers) {
        const person = byKey.get(value.trim().toLowerCase())
        const unmatched = (reason: UnmatchedReason) => {
          result.unmatched.push({ value, reason })
        }
        if (!person) unmatched('not_found')
        else if (person.role !== 'student') unmatched('not_a_student')
        else if (person.status !== 'active') unmatched('not_active')
        else if (!seen.has(person.id)) {
          seen.add(person.id)
          ;(enrolled.has(person.id) ? result.alreadyEnrolled : result.matched).push(
            toStudent(person),
          )
        }
      }
      return result
    },

    async enrollStudents(courseId, studentIds) {
      await requireSession()
      const course = await findInUse(courseId)
      // SECURITY: only active students, each once, whatever the caller sends.
      const ids = [...new Set(studentIds)].filter((id) => isUuid(id))
      if (ids.length === 0) return { added: 0 }
      const eligible = await readRows(
        client
          .from('profiles')
          .select('id')
          .in('id', ids)
          .eq('role', 'student')
          .eq('status', 'active'),
        idRow,
      )
      if (eligible.length === 0) return { added: 0 }
      // Rows already there are skipped by the database, so a double click adds nobody twice.
      const added = await readRows(
        client
          .from('enrollments')
          .upsert(
            eligible.map((student) => ({ course_id: course.id, student_id: student.id })),
            { onConflict: 'course_id,student_id', ignoreDuplicates: true },
          )
          .select('student_id'),
        studentIdRow,
      )
      return { added: added.length }
    },

    async removeStudent(courseId, studentId) {
      await requireSession()
      const course = await findInUse(courseId)
      if (!isUuid(studentId)) throw new AppError('not_found', 'This student isn’t in the course.')
      const removed = await readRows(
        client
          .from('enrollments')
          .delete()
          .eq('course_id', course.id)
          .eq('student_id', studentId)
          .select('student_id'),
        studentIdRow,
      )
      if (removed.length === 0) throw new AppError('not_found', 'This student isn’t in the course.')
    },

    async listEnrollmentRequests(courseId) {
      const course = await findRow(courseId)
      const rows = await readRows(
        client
          .from('enrollment_requests')
          .select(`id, created_at, student:profiles!student_id(${PERSON_COLUMNS})`)
          .eq('course_id', course.id)
          .eq('status', 'pending')
          .order('created_at'),
        requestRow,
      )
      return rows.flatMap((row): EnrollmentRequest[] =>
        row.student
          ? [{ id: row.id, student: toStudent(row.student), requestedAt: iso(row.created_at) }]
          : [],
      )
    },

    async decideEnrollmentRequest(requestId, decision) {
      await requireSession()
      if (!isUuid(requestId)) throw new AppError('not_found', 'Request not found.')
      // The database function checks the caller, locks the request, and enrols on approval.
      const { error } = await client.rpc('decide_enrollment_request', {
        p_request: requestId,
        p_decision: decision,
      })
      if (!error) return
      const code = databaseCode(error)
      const message = databaseMessage(error)
      if (code === 'P0002') throw new AppError('not_found', 'Request not found.')
      if (code === '23505') {
        throw new AppError('conflict', 'This request has already been decided.')
      }
      if (message.includes('course archived')) throw new AppError('validation', ARCHIVED_MESSAGE)
      if (message.includes('cannot be enrolled')) {
        throw new AppError('validation', CANNOT_ENROL_MESSAGE)
      }
      throw writeError(error)
    },
  }
}
