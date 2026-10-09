/**
 * The demo ClassService (admin REQUIREMENTS section 13): the classes in the demo platform,
 * searched, filtered and changed the way the database will. Every change writes an audit entry,
 * and `onChange` lets the app save the platform so changes survive a reload.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'
// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'
// The schema type the form rules share.
import type { ZodType } from 'zod'

// The form rules, enforced here too.
import { classSchema } from '@/lib/classSchemas'
// Local dates and times to instants.
import { toDateInput, toIso } from '@/lib/classTimes'
// Class shapes.
import type {
  ClassDetails,
  ClassFilter,
  ClassListItem,
  ClassSort,
  SummaryStep,
} from '@/types/classes'

// The records it reads and writes.
import type { AuditEntry, ClassRecord, PlatformData } from '../platformData'
// The interface implemented here.
import type { ClassService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'

/** How many classes a page holds. */
export const CLASS_PAGE_SIZE = 20

/** What an archived course says to a new class. */
const COURSE_ARCHIVED_MESSAGE = 'This course is archived. Restore it to make changes.'

/** The summary stages, in the order a summary passes through them. */
const STAGES: readonly SummaryStatus[] = ['collecting', 'processing', 'in_review', 'published']

/** What the demo service needs. */
interface MockClassOptions {
  // The platform's records; changes are made to it directly.
  data: PlatformData
  now: () => Date
  // The signed-in administrator's ID, or null when nobody is signed in.
  actorId: () => string | null
  latencyMs: number
  // Called after every change, so the app can save the platform.
  onChange?: () => void
}

/** Throws a validation AppError with the schema's first message if `value` breaks it. */
function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError('validation', result.error.issues[0]?.message ?? 'Check the details.')
  }
  return result.data
}

/** Compares names for sorting, ignoring case and accents. */
function compareText(a: string, b: string) {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

/** Builds the demo ClassService over `data`. */
export function createMockClassService({
  data,
  now,
  actorId,
  latencyMs,
  onChange,
}: MockClassOptions): ClassService {
  /** The class with `classId`, or a not-found error. */
  function find(classId: string): ClassRecord {
    const item = data.classes.find((candidate) => candidate.id === classId)
    if (!item) throw new AppError('not_found', 'Class not found.')
    return item
  }

  /** The signed-in administrator's ID. SECURITY: no change is made without one. */
  function requireActor(): string {
    const id = actorId()
    if (!id) throw new AppError('unauthorized', 'Sign in again to continue.')
    return id
  }

  /** The summary of a class, if it has one. */
  function summaryOf(classId: string) {
    return data.summaries.find((summary) => summary.classId === classId)
  }

  /** The list row for `item`. */
  function toListItem(item: ClassRecord): ClassListItem {
    // Its course always exists; the placeholder keeps a damaged record from crashing the list.
    const course = data.courses.find((candidate) => candidate.id === item.courseId)
    const teacher = data.users.find((user) => user.id === course?.teacherId)
    return {
      id: item.id,
      number: item.number,
      courseId: item.courseId,
      courseCode: course?.code ?? '—',
      courseTitle: course?.title ?? '',
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      teacher: teacher ? { id: teacher.id, fullName: teacher.fullName } : null,
      summaryStatus: summaryOf(item.id)?.status ?? null,
      noteCount: item.noteCount,
      archivedAt: item.archivedAt,
    }
  }

  /** The summary timeline for `item`: each stage, whether it was reached, and when. */
  function timelineOf(item: ClassRecord, jobCreatedTimes: string[]): SummaryStep[] {
    const summary = summaryOf(item.id)
    // How far the summary has got; nothing, without one.
    const reachedRank = summary ? STAGES.indexOf(summary.status) : -1
    // When each stage began, where it is recorded.
    const times: Record<SummaryStatus, string | null> = {
      collecting: item.startsAt,
      processing: jobCreatedTimes[0] ?? null,
      in_review: summary?.inReviewSince ?? null,
      published: summary?.publishedAt ?? null,
    }
    return STAGES.map((stage, rank) => ({
      stage,
      at: rank <= reachedRank ? times[stage] : null,
      reached: rank <= reachedRank,
    }))
  }

  /** The details page for `item`. */
  function toDetails(item: ClassRecord): ClassDetails {
    // The class's AI jobs, oldest first.
    const aiJobs = data.aiJobs
      .filter((job) => job.classId === item.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ id, status, attempt, createdAt, finishedAt }) => ({
        id,
        status,
        attempt,
        createdAt,
        finishedAt,
      }))
    return {
      ...toListItem(item),
      description: item.description,
      studentCount: data.enrollments.filter((e) => e.courseId === item.courseId).length,
      aiJobs,
      timeline: timelineOf(
        item,
        aiJobs.map((job) => job.createdAt),
      ),
    }
  }

  /** The comparison for each sort; ties fall back to the course code, then the class number. */
  function comparator(sort: ClassSort): (a: ClassListItem, b: ClassListItem) => number {
    // "-" in front means newest or Z first.
    const descending = sort.startsWith('-')
    const field = descending ? sort.slice(1) : sort
    const direction = descending ? -1 : 1
    return (a, b) => {
      const primary =
        field === 'title'
          ? compareText(a.title, b.title)
          : field === 'course'
            ? compareText(a.courseCode, b.courseCode)
            : a.startsAt.localeCompare(b.startsAt)
      return direction * primary || compareText(a.courseCode, b.courseCode) || a.number - b.number
    }
  }

  /** Whether `row` passes the search and filters. */
  function matches(row: ClassListItem, filter: ClassFilter, q: string | undefined) {
    // The class's local date, to compare with the range.
    const date = toDateInput(row.startsAt)
    return (
      (row.archivedAt !== null) === Boolean(filter.archived) &&
      (!filter.courseId || row.courseId === filter.courseId) &&
      (!filter.summaryStatus ||
        (filter.summaryStatus === 'none'
          ? row.summaryStatus === null
          : row.summaryStatus === filter.summaryStatus)) &&
      (!filter.from || date >= filter.from) &&
      (!filter.to || date <= filter.to) &&
      (!q || row.title.toLowerCase().includes(q) || row.courseCode.toLowerCase().includes(q))
    )
  }

  /** Appends an audit entry for `item`, then reports the change. */
  function record(
    actor: string,
    action: string,
    item: ClassRecord,
    metadata: AuditEntry['metadata'],
  ) {
    // SECURITY: an append-only trail of who changed what; never note content.
    data.auditLog.push({
      id: `audit-${crypto.randomUUID()}`,
      at: now().toISOString(),
      actorId: actor,
      action,
      entityType: 'class',
      entityId: item.id,
      metadata,
    })
    // Let the app save the platform.
    onChange?.()
  }

  return {
    async listClasses(filter) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // The search in lower case, then the matching classes, sorted (newest first by default).
      const q = filter.q?.trim().toLowerCase()
      const rows = data.classes
        .map(toListItem)
        .filter((row) => matches(row, filter, q))
        .sort(comparator(filter.sort ?? '-date'))
      // The requested page; past the end shows the last page.
      const lastPage = Math.max(1, Math.ceil(rows.length / CLASS_PAGE_SIZE))
      const page = Math.min(Math.max(1, filter.page ?? 1), lastPage)
      const start = (page - 1) * CLASS_PAGE_SIZE
      return {
        items: rows.slice(start, start + CLASS_PAGE_SIZE),
        total: rows.length,
        page,
        pageSize: CLASS_PAGE_SIZE,
      }
    },

    async listClassFilterOptions() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Every course by code; archived ones can be filtered by but not given classes.
      const courses = data.courses
        .map(({ id, code, title, archivedAt }) => ({
          id,
          code,
          title,
          archived: archivedAt !== null,
        }))
        .sort((a, b) => compareText(a.code, b.code))
      return { courses }
    },

    async getClass(classId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      return toDetails(find(classId))
    },

    async createClass(input) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is creating, whether the details are valid, and whether the course can take a class.
      const actor = requireActor()
      const values = parseOrThrow(classSchema, input)
      const course = data.courses.find((candidate) => candidate.id === values.courseId)
      if (!course) throw new AppError('validation', 'Choose a course.')
      if (course.archivedAt !== null) throw new AppError('validation', COURSE_ARCHIVED_MESSAGE)
      // Numbered after the course's last class, archived ones included, so a number is never reused.
      const last = Math.max(
        0,
        ...data.classes.filter((c) => c.courseId === course.id).map((c) => c.number),
      )
      const item: ClassRecord = {
        id: `class-${crypto.randomUUID()}`,
        courseId: course.id,
        number: last + 1,
        title: values.title,
        description: values.description,
        startsAt: toIso(values.date, values.startTime),
        endsAt: toIso(values.date, values.endTime),
        noteCount: 0,
        archivedAt: null,
      }
      data.classes.push(item)
      record(actor, 'class.created', item, { courseId: course.id, number: String(item.number) })
      return toDetails(item)
    },

    async updateClass(classId, input) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is editing, which class, and whether the details are valid.
      const actor = requireActor()
      const item = find(classId)
      if (item.archivedAt !== null) {
        throw new AppError('validation', 'This class is archived. It can’t be changed.')
      }
      const values = parseOrThrow(classSchema, input)
      // A class keeps its course, so its number stays meaningful.
      if (values.courseId !== item.courseId) {
        throw new AppError('validation', 'A class can’t move to another course.')
      }
      // Apply the changes.
      item.title = values.title
      item.description = values.description
      item.startsAt = toIso(values.date, values.startTime)
      item.endsAt = toIso(values.date, values.endTime)
      record(actor, 'class.updated', item, { courseId: item.courseId })
      return toDetails(item)
    },

    async archiveClass(classId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is archiving, and which class.
      const actor = requireActor()
      const item = find(classId)
      if (item.archivedAt !== null) {
        throw new AppError('validation', 'This class is already archived.')
      }
      // Hide it; its notes and summary stay.
      item.archivedAt = now().toISOString()
      record(actor, 'class.archived', item, { courseId: item.courseId })
      return toDetails(item)
    },
  }
}
