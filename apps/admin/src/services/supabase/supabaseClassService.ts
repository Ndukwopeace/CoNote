/**
 * The admin ClassService on Supabase (milestone B2.6b, D85): the classes of every course, their
 * summary stage and AI job history. Row Level Security lets only an administrator read the list
 * view or write `class_sessions`, so every rule here is also held by the database. Notes are only
 * ever counted, and a summary's text is never read. The contract suite runs against this service
 * and the demo service alike.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'
// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Turns database failures into AppErrors.
import { fromSupabaseError } from '@conote/supabase/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'
// Reads and checks rows.
import { readOne, readRows } from '@conote/supabase/rows'

// The form rules, enforced here too.
import { classSchema } from '@/lib/classSchemas'
// Local dates and times to instants.
import { toIso } from '@/lib/classTimes'
// Class shapes.
import type {
  ClassDetails,
  ClassFilter,
  ClassListItem,
  ClassSort,
  SummaryStep,
} from '@/types/classes'

// The interface this implementation must satisfy.
import type { ClassService } from '../types'

// Search text, times and names.
import { compareText, iso, safeSearch } from './queryText'

/** How many classes a page holds. */
const PAGE_SIZE = 20

/** What an archived course says to a new class. */
const COURSE_ARCHIVED_MESSAGE = 'This course is archived. Restore it to make changes.'

/** The summary stages, in the order a summary passes through them. */
const STAGES: readonly SummaryStatus[] = ['collecting', 'processing', 'in_review', 'published']

// The columns of the list view the service reads.
const CLASS_COLUMNS =
  'id, number, course_id, course_code, course_title, title, description, starts_at, ends_at, archived_at, teacher_id, teacher_name, summary_status, in_review_since, published_at, note_count, student_count'

// SECURITY: each shape is checked on arrival, so a stage or status the app does not know is
// refused instead of reaching a screen.
const classRow = z.object({
  id: z.string(),
  number: z.number(),
  course_id: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  title: z.string(),
  description: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  archived_at: z.string().nullable(),
  teacher_id: z.string().nullable(),
  teacher_name: z.string().nullable(),
  summary_status: z
    .enum(['collecting', 'processing', 'in_review', 'published', 'failed'])
    .nullable(),
  in_review_since: z.string().nullable(),
  published_at: z.string().nullable(),
  note_count: z.number(),
  student_count: z.number(),
})
// A course the filter or form offers.
const courseOptionRow = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  archived_at: z.string().nullable(),
})
// A course a class is being added to.
const courseStateRow = z.object({ id: z.string(), archived_at: z.string().nullable() })
// One AI job in a class's history.
const jobRow = z.object({
  id: z.string(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  attempt: z.number(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
})
// What an insert reads back.
const idRow = z.object({ id: z.string() })

type ClassRow = z.infer<typeof classRow>

/** What the service needs. */
interface SupabaseClassOptions {
  // The one client the console uses.
  client: SupabaseClient
  // The clock, for the time a class is archived. Tests set it; the app uses the real one.
  now?: () => Date
}

/** The stage shown for a summary: a failed run counts as still processing, as students see it. */
function stageOf(row: ClassRow): SummaryStatus | null {
  return row.summary_status === 'failed' ? 'processing' : row.summary_status
}

/** The start of the local day after `date` (YYYY-MM-DD), as an instant. */
function endOfDay(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return new Date(year, month - 1, day + 1).toISOString()
}

/** The class as a list row. */
function toListItem(row: ClassRow): ClassListItem {
  return {
    id: row.id,
    number: row.number,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    title: row.title,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    teacher:
      row.teacher_id === null ? null : { id: row.teacher_id, fullName: row.teacher_name ?? '' },
    summaryStatus: stageOf(row),
    noteCount: row.note_count,
    archivedAt: row.archived_at === null ? null : iso(row.archived_at),
  }
}

/** Throws the validation error a form shows if `value` breaks the class rules. */
function parseClass(value: unknown) {
  const result = classSchema.safeParse(value)
  if (!result.success) {
    throw new AppError('validation', result.error.issues[0]?.message ?? 'Check the details.')
  }
  return result.data
}

/** Builds the Supabase ClassService. */
export function createSupabaseClassService({
  client,
  now = () => new Date(),
}: SupabaseClassOptions): ClassService {
  /** The filtered list query; `head` asks only for the count. */
  function listQuery(filter: ClassFilter, columns: string, head: boolean) {
    // Count every match, whichever page is asked for.
    let query = client.from('admin_classes').select(columns, { count: 'exact', head })
    // In use, or archived.
    query = filter.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
    if (filter.courseId) query = query.eq('course_id', filter.courseId)
    if (filter.summaryStatus === 'none') query = query.is('summary_status', null)
    else if (filter.summaryStatus === 'processing') {
      query = query.in('summary_status', ['processing', 'failed'])
    } else if (filter.summaryStatus) query = query.eq('summary_status', filter.summaryStatus)
    // Both ends of the range are included, as local days.
    if (filter.from) query = query.gte('starts_at', toIso(filter.from, '00:00'))
    if (filter.to) query = query.lt('starts_at', endOfDay(filter.to))
    const q = safeSearch(filter.q)
    if (q) query = query.or(`title.ilike.%${q}%,course_code.ilike.%${q}%`)
    return query
  }

  /** SECURITY: no change is attempted without a signed-in session. */
  async function requireSession(): Promise<void> {
    const { data } = await client.auth.getSession()
    if (!data.session) throw new AppError('unauthorized', 'Sign in again to continue.')
  }

  /** One class's list row, or not_found. */
  async function findRow(classId: string): Promise<ClassRow> {
    // SECURITY: an ID that is not a UUID never reaches a query.
    if (!isUuid(classId)) throw new AppError('not_found', 'Class not found.')
    const row = await readOne(
      client.from('admin_classes').select(CLASS_COLUMNS).eq('id', classId).maybeSingle(),
      classRow,
    )
    if (!row) throw new AppError('not_found', 'Class not found.')
    return row
  }

  /** The summary timeline: each stage, whether it was reached, and when. */
  function timelineOf(row: ClassRow, jobCreatedTimes: string[]): SummaryStep[] {
    const stage = stageOf(row)
    // How far the summary has got; nothing, without one.
    const reachedRank = stage === null ? -1 : STAGES.indexOf(stage)
    // When each stage began, where it is recorded.
    const times: Record<SummaryStatus, string | null> = {
      collecting: iso(row.starts_at),
      processing: jobCreatedTimes[0] ?? null,
      in_review: row.in_review_since === null ? null : iso(row.in_review_since),
      published: row.published_at === null ? null : iso(row.published_at),
    }
    return STAGES.map((name, rank) => ({
      stage: name,
      at: rank <= reachedRank ? times[name] : null,
      reached: rank <= reachedRank,
    }))
  }

  /** The details page for the class in `row`. */
  async function toDetails(row: ClassRow): Promise<ClassDetails> {
    // The class's AI jobs, oldest first.
    const jobs = await readRows(
      client
        .from('ai_jobs')
        .select('id, status, attempt, created_at, finished_at')
        .eq('class_id', row.id)
        .order('created_at'),
      jobRow,
    )
    const aiJobs = jobs.map((job) => ({
      id: job.id,
      status: job.status,
      attempt: job.attempt,
      createdAt: iso(job.created_at),
      finishedAt: job.finished_at === null ? null : iso(job.finished_at),
    }))
    return {
      ...toListItem(row),
      description: row.description,
      studentCount: row.student_count,
      aiJobs,
      timeline: timelineOf(
        row,
        aiJobs.map((job) => job.createdAt),
      ),
    }
  }

  return {
    async listClasses(filter) {
      // SECURITY: a course ID that is not a UUID matches nothing and never reaches a query.
      if (filter.courseId && !isUuid(filter.courseId)) {
        return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE }
      }
      // How many classes match, so a page past the end can show the last page instead.
      const counted = await listQuery(filter, 'id', true)
      if (counted.error) throw fromSupabaseError(counted.error)
      const total = counted.count ?? 0
      const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
      const page = Math.min(Math.max(1, filter.page ?? 1), lastPage)
      // The sort: a field, "-" in front for descending, ties by course code then number.
      const sort: ClassSort = filter.sort ?? '-date'
      const descending = sort.startsWith('-')
      const field = descending ? sort.slice(1) : sort
      const column = field === 'title' ? 'title' : field === 'course' ? 'course_code' : 'starts_at'
      const start = (page - 1) * PAGE_SIZE
      let query = listQuery(filter, CLASS_COLUMNS, false).order(column, { ascending: !descending })
      if (column !== 'course_code') query = query.order('course_code')
      query = query.order('number')
      // Past the last row there is nothing to ask for.
      const rows =
        total === 0 ? [] : await readRows(query.range(start, start + PAGE_SIZE - 1), classRow)
      return { items: rows.map(toListItem), total, page, pageSize: PAGE_SIZE }
    },

    async listClassFilterOptions() {
      // Every course by code; archived ones can be filtered by but not given classes.
      const courses = await readRows(
        client.from('admin_courses').select('id, code, title, archived_at'),
        courseOptionRow,
      )
      return {
        courses: courses
          .map((course) => ({
            id: course.id,
            code: course.code,
            title: course.title,
            archived: course.archived_at !== null,
          }))
          .sort((a, b) => compareText(a.code, b.code)),
      }
    },

    async getClass(classId) {
      return toDetails(await findRow(classId))
    },

    async createClass(input) {
      await requireSession()
      const values = parseClass(input)
      // The course must exist and be in use. SECURITY: an ID that is not a UUID never reaches a query.
      if (!isUuid(values.courseId)) throw new AppError('validation', 'Choose a course.')
      const course = await readOne(
        client
          .from('admin_courses')
          .select('id, archived_at')
          .eq('id', values.courseId)
          .maybeSingle(),
        courseStateRow,
      )
      if (!course) throw new AppError('validation', 'Choose a course.')
      if (course.archived_at !== null) throw new AppError('validation', COURSE_ARCHIVED_MESSAGE)
      // The database numbers it after the course's last class, archived ones included.
      const { data, error } = await client
        .from('class_sessions')
        .insert({
          course_id: course.id,
          title: values.title,
          description: values.description,
          starts_at: toIso(values.date, values.startTime),
          ends_at: toIso(values.date, values.endTime),
        })
        .select('id')
        .single()
      if (error) throw fromSupabaseError(error)
      return toDetails(await findRow(idRow.parse(data).id))
    },

    async updateClass(classId, input) {
      await requireSession()
      const row = await findRow(classId)
      if (row.archived_at !== null) {
        throw new AppError('validation', 'This class is archived. It can’t be changed.')
      }
      const values = parseClass(input)
      // A class keeps its course, so its number stays meaningful.
      if (values.courseId !== row.course_id) {
        throw new AppError('validation', 'A class can’t move to another course.')
      }
      const { error } = await client
        .from('class_sessions')
        .update({
          title: values.title,
          description: values.description,
          starts_at: toIso(values.date, values.startTime),
          ends_at: toIso(values.date, values.endTime),
        })
        .eq('id', row.id)
      if (error) throw fromSupabaseError(error)
      return toDetails(await findRow(row.id))
    },

    async archiveClass(classId) {
      await requireSession()
      const row = await findRow(classId)
      if (row.archived_at !== null) {
        throw new AppError('validation', 'This class is already archived.')
      }
      // Hide it; its notes and summary stay.
      const { error } = await client
        .from('class_sessions')
        .update({ archived_at: now().toISOString() })
        .eq('id', row.id)
      if (error) throw fromSupabaseError(error)
      return toDetails(await findRow(row.id))
    },
  }
}
