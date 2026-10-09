/**
 * The demo CourseService (admin REQUIREMENTS section 12): the courses in the demo platform,
 * searched, filtered and changed the way the database will. Every change writes an audit entry,
 * and `onChange` lets the app save the platform so changes survive a reload.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'
// The schema type the form rules share.
import type { ZodType } from 'zod'

// The form rules, enforced here too.
import { courseSchema, normalizeCourseCode } from '@/lib/courseSchemas'
// Course shapes.
import type {
  CourseDetails,
  CourseFilter,
  CourseListItem,
  CourseSort,
  EnrolledStudent,
  EnrollmentMatch,
  EnrollmentRequest,
  PersonRef,
  RequestDecision,
} from '@/types/courses'

// The records it reads and writes.
import type {
  AuditEntry,
  CourseRecord,
  EnrollmentRequestRecord,
  PlatformData,
  UserRecord,
} from '../platformData'
// The interface implemented here.
import type { CourseService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'

/** How many courses a page holds. */
export const COURSE_PAGE_SIZE = 20

/** What an archived course says to every change. */
const ARCHIVED_MESSAGE = 'This course is archived. Restore it to make changes.'

/** What a request from an account that can't be enrolled gets told. */
const CANNOT_ENROL_MESSAGE = "This account can't be enrolled."

/** What an unusable teacher gets told. */
const TEACHER_MESSAGE = 'Choose an active teacher.'

/** What the demo service needs. */
interface MockCourseOptions {
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

/** The person as the course screens name them. */
function personRef(user: UserRecord): PersonRef {
  return { id: user.id, fullName: user.fullName }
}

/** Compares names for sorting, ignoring case and accents. */
function compareText(a: string, b: string) {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

/** Builds the demo CourseService over `data`. */
export function createMockCourseService({
  data,
  now,
  actorId,
  latencyMs,
  onChange,
}: MockCourseOptions): CourseService {
  /** The course with `courseId`, or a not-found error. */
  function find(courseId: string): CourseRecord {
    const course = data.courses.find((candidate) => candidate.id === courseId)
    if (!course) throw new AppError('not_found', 'Course not found.')
    return course
  }

  /** The course to change: it exists and is in use. */
  function findInUse(courseId: string): CourseRecord {
    const course = find(courseId)
    // An archived course refuses changes until it is restored.
    if (course.archivedAt !== null) throw new AppError('validation', ARCHIVED_MESSAGE)
    return course
  }

  /** The signed-in administrator's ID. SECURITY: no change is made without one. */
  function requireActor(): string {
    const id = actorId()
    if (!id) throw new AppError('unauthorized', 'Sign in again to continue.')
    return id
  }

  /** The active teacher with `teacherId`. Anyone else is turned away with the same message. */
  function requireTeacher(teacherId: string): UserRecord {
    const teacher = data.users.find((user) => user.id === teacherId)
    if (teacher?.role !== 'teacher' || teacher.status !== 'active') {
      throw new AppError('validation', TEACHER_MESSAGE)
    }
    return teacher
  }

  /** Throws a conflict if another course already has `code` (compared in the stored form). */
  function requireFreeCode(code: string, exceptId?: string) {
    const taken = data.courses.some(
      (course) => course.id !== exceptId && normalizeCourseCode(course.code) === code,
    )
    if (taken) throw new AppError('conflict', 'A course with this code already exists.')
  }

  /** Appends an audit entry for `course`, then reports the change. */
  function record(
    actor: string,
    action: string,
    course: CourseRecord,
    metadata: AuditEntry['metadata'],
  ) {
    // SECURITY: an append-only trail of who changed what; never note content.
    data.auditLog.push({
      id: `audit-${crypto.randomUUID()}`,
      at: now().toISOString(),
      actorId: actor,
      action,
      entityType: 'course',
      entityId: course.id,
      metadata,
    })
    // Let the app save the platform.
    onChange?.()
  }

  /** The IDs of `courseId`'s students. */
  function enrolledIds(courseId: string): Set<string> {
    return new Set(data.enrollments.filter((e) => e.courseId === courseId).map((e) => e.studentId))
  }

  /** The requests to join `courseId` that are waiting for a decision, oldest first. */
  function pendingRequests(courseId: string): EnrollmentRequestRecord[] {
    return data.enrollmentRequests
      .filter((request) => request.courseId === courseId && request.status === 'pending')
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  }

  /** The student as the enrolment screens show them. */
  function toStudent(user: UserRecord): EnrolledStudent {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      studentNumber: user.studentNumber,
      status: user.status,
    }
  }

  /** The list row for `course`. */
  function toListItem(course: CourseRecord): CourseListItem {
    const teacher = data.users.find((user) => user.id === course.teacherId)
    return {
      id: course.id,
      code: course.code,
      title: course.title,
      department: course.department,
      status: course.status,
      teacher: teacher ? personRef(teacher) : null,
      studentCount: data.enrollments.filter((e) => e.courseId === course.id).length,
      // Classes still in use.
      classCount: data.classes.filter((c) => c.courseId === course.id && c.archivedAt === null)
        .length,
      pendingRequestCount: pendingRequests(course.id).length,
      archivedAt: course.archivedAt,
    }
  }

  /** The details page for `course`. */
  function toDetails(course: CourseRecord): CourseDetails {
    // The course's classes, oldest first, and each one's summary stage.
    const classes = data.classes
      .filter((item) => item.courseId === course.id)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const summaryOf = (classId: string) => data.summaries.find((s) => s.classId === classId)
    const classTitles = new Map(classes.map((item) => [item.id, item.title]))
    return {
      ...toListItem(course),
      description: course.description,
      createdAt: course.createdAt,
      publishedSummaryCount: classes.filter((item) => summaryOf(item.id)?.status === 'published')
        .length,
      classes: classes.map((item) => ({
        id: item.id,
        title: item.title,
        startsAt: item.startsAt,
        summaryStatus: summaryOf(item.id)?.status ?? null,
        archived: item.archivedAt !== null,
      })),
      resources: data.resources
        .filter((resource) => resource.courseId === course.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((resource) => ({
          id: resource.id,
          title: resource.title,
          type: resource.type,
          status: resource.status,
          classTitle: resource.classId ? (classTitles.get(resource.classId) ?? null) : null,
        })),
    }
  }

  /** The comparison for each sort; ties fall back to the code. */
  function comparator(sort: CourseSort): (a: CourseListItem, b: CourseListItem) => number {
    // "-" in front means Z first or most first.
    const descending = sort.startsWith('-')
    const field = descending ? sort.slice(1) : sort
    const direction = descending ? -1 : 1
    return (a, b) => {
      const primary =
        field === 'students'
          ? a.studentCount - b.studentCount
          : field === 'title'
            ? compareText(a.title, b.title)
            : compareText(a.code, b.code)
      return direction * primary || compareText(a.code, b.code)
    }
  }

  /** Whether `course` passes the search and filters. */
  function matches(course: CourseRecord, filter: CourseFilter, q: string | undefined) {
    return (
      (course.archivedAt !== null) === Boolean(filter.archived) &&
      (!filter.status || course.status === filter.status) &&
      (!filter.department || course.department === filter.department) &&
      (!filter.teacher ||
        (filter.teacher === 'none'
          ? course.teacherId === null
          : course.teacherId === filter.teacher)) &&
      (!filter.requests || pendingRequests(course.id).length > 0) &&
      (!q || course.code.toLowerCase().includes(q) || course.title.toLowerCase().includes(q))
    )
  }

  return {
    async listCourses(filter) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // The search in lower case, then the matching courses, sorted.
      const q = filter.q?.trim().toLowerCase()
      const items = data.courses
        .filter((course) => matches(course, filter, q))
        .map(toListItem)
        .sort(comparator(filter.sort ?? 'code'))
      // The requested page; past the end shows the last page.
      const lastPage = Math.max(1, Math.ceil(items.length / COURSE_PAGE_SIZE))
      const page = Math.min(Math.max(1, filter.page ?? 1), lastPage)
      const start = (page - 1) * COURSE_PAGE_SIZE
      return {
        items: items.slice(start, start + COURSE_PAGE_SIZE),
        total: items.length,
        page,
        pageSize: COURSE_PAGE_SIZE,
      }
    },

    async listCourseFilterOptions() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Every department in use by an account or a course, A to Z.
      const departments = [
        ...new Set(
          [...data.users, ...data.courses].flatMap(({ department }) =>
            department ? [department] : [],
          ),
        ),
      ].sort(compareText)
      // The active teachers, A to Z.
      const teachers = data.users
        .filter((user) => user.role === 'teacher' && user.status === 'active')
        .map((user) => ({ ...personRef(user), department: user.department }))
        .sort((a, b) => compareText(a.fullName, b.fullName))
      return { departments, teachers }
    },

    async getCourse(courseId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      return toDetails(find(courseId))
    },

    async createCourse(input) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is creating, whether the details are valid, and whether the code and teacher are usable.
      const actor = requireActor()
      const values = parseOrThrow(courseSchema, input)
      requireFreeCode(values.code)
      if (values.teacherId !== null) requireTeacher(values.teacherId)
      // The course.
      const course: CourseRecord = {
        id: `course-${crypto.randomUUID()}`,
        ...values,
        createdAt: now().toISOString(),
        archivedAt: null,
      }
      data.courses.push(course)
      record(actor, 'course.created', course, { code: course.code })
      return toDetails(course)
    },

    async updateCourse(courseId, input) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is editing, which course, and whether the details are valid.
      const actor = requireActor()
      const course = findInUse(courseId)
      const values = parseOrThrow(courseSchema, input)
      requireFreeCode(values.code, course.id)
      // A teacher who has since been deactivated may stay; only a different one must be active.
      if (values.teacherId !== null && values.teacherId !== course.teacherId) {
        requireTeacher(values.teacherId)
      }
      // Apply the changes, noting a teacher change on its own.
      const previousTeacher = course.teacherId
      Object.assign(course, values)
      record(actor, 'course.updated', course, { code: course.code })
      if (values.teacherId !== previousTeacher) {
        record(
          actor,
          values.teacherId === null ? 'course.teacher_removed' : 'course.teacher_assigned',
          course,
          { teacherId: values.teacherId ?? previousTeacher },
        )
      }
      return toDetails(course)
    },

    async archiveCourse(courseId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is archiving, and which course.
      const actor = requireActor()
      const course = find(courseId)
      if (course.archivedAt !== null) {
        throw new AppError('validation', 'This course is already archived.')
      }
      // Take it out of use; its classes, notes and students stay.
      course.archivedAt = now().toISOString()
      record(actor, 'course.archived', course, { code: course.code })
      return toDetails(course)
    },

    async restoreCourse(courseId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is restoring, and which course.
      const actor = requireActor()
      const course = find(courseId)
      if (course.archivedAt === null) {
        throw new AppError('validation', 'This course is not archived.')
      }
      course.archivedAt = null
      record(actor, 'course.restored', course, { code: course.code })
      return toDetails(course)
    },

    async assignTeacher(courseId, teacherId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is assigning, which course, and whether the teacher can be.
      const actor = requireActor()
      const course = findInUse(courseId)
      const teacher = requireTeacher(teacherId)
      course.teacherId = teacher.id
      record(actor, 'course.teacher_assigned', course, { teacherId: teacher.id })
      return toDetails(course)
    },

    async removeTeacher(courseId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is removing, and from which course.
      const actor = requireActor()
      const course = findInUse(courseId)
      // Nobody to remove: nothing changes, so nothing is recorded.
      if (course.teacherId === null) return toDetails(course)
      const teacherId = course.teacherId
      course.teacherId = null
      record(actor, 'course.teacher_removed', course, { teacherId })
      return toDetails(course)
    },

    async listEnrollments(courseId, q) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      find(courseId)
      // The search in lower case, and the course's students.
      const query = q?.trim().toLowerCase()
      const ids = enrolledIds(courseId)
      return data.users
        .filter(
          (user) =>
            ids.has(user.id) &&
            (!query ||
              [user.fullName, user.email, user.studentNumber].some((field) =>
                field?.toLowerCase().includes(query),
              )),
        )
        .map(toStudent)
        .sort((a, b) => compareText(a.fullName, b.fullName))
    },

    async matchStudents(courseId, identifiers) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      find(courseId)
      // Accounts by email and by student number, in lower case.
      const byKey = new Map<string, UserRecord>()
      for (const user of data.users) {
        byKey.set(user.email.toLowerCase(), user)
        if (user.studentNumber) byKey.set(user.studentNumber.toLowerCase(), user)
      }
      const enrolled = enrolledIds(courseId)
      // Sort each value; a person reached twice is listed once.
      const result: EnrollmentMatch = { matched: [], alreadyEnrolled: [], unmatched: [] }
      const seen = new Set<string>()
      for (const value of identifiers) {
        const user = byKey.get(value.trim().toLowerCase())
        if (!user) {
          result.unmatched.push({ value, reason: 'not_found' })
        } else if (user.role !== 'student') {
          result.unmatched.push({ value, reason: 'not_a_student' })
        } else if (user.status !== 'active') {
          result.unmatched.push({ value, reason: 'not_active' })
        } else if (!seen.has(user.id)) {
          seen.add(user.id)
          ;(enrolled.has(user.id) ? result.alreadyEnrolled : result.matched).push(toStudent(user))
        }
      }
      return result
    },

    async enrollStudents(courseId, studentIds) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is enrolling, and in which course.
      const actor = requireActor()
      const course = findInUse(courseId)
      // SECURITY: only active students who aren't in yet, each once, whatever the caller sends.
      const enrolled = enrolledIds(courseId)
      const students = [...new Set(studentIds)].flatMap((id) => {
        const user = data.users.find((candidate) => candidate.id === id)
        return user?.role === 'student' && user.status === 'active' && !enrolled.has(id)
          ? [user]
          : []
      })
      // Enrol them, one audit entry each.
      for (const student of students) {
        data.enrollments.push({ courseId, studentId: student.id })
        record(actor, 'enrollment.added', course, { studentId: student.id })
      }
      return { added: students.length }
    },

    async removeStudent(courseId, studentId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is removing, and from which course.
      const actor = requireActor()
      const course = findInUse(courseId)
      const index = data.enrollments.findIndex(
        (enrollment) => enrollment.courseId === courseId && enrollment.studentId === studentId,
      )
      if (index === -1) throw new AppError('not_found', 'This student isn’t in the course.')
      data.enrollments.splice(index, 1)
      record(actor, 'enrollment.removed', course, { studentId })
    },

    async listEnrollmentRequests(courseId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      find(courseId)
      // The waiting requests, oldest first, each with the student who asked.
      return pendingRequests(courseId).flatMap((request): EnrollmentRequest[] => {
        const student = data.users.find((user) => user.id === request.studentId)
        return student
          ? [{ id: request.id, student: toStudent(student), requestedAt: request.createdAt }]
          : []
      })
    },

    async decideEnrollmentRequest(requestId, decision: RequestDecision) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // SECURITY: only a signed-in administrator decides.
      const actor = requireActor()
      const request = data.enrollmentRequests.find((candidate) => candidate.id === requestId)
      if (!request) throw new AppError('not_found', 'Request not found.')
      // A request is decided once.
      if (request.status !== 'pending') {
        throw new AppError('conflict', 'This request has already been decided.')
      }
      // An archived course refuses both decisions.
      const course = findInUse(request.courseId)
      const student = data.users.find((user) => user.id === request.studentId)

      if (decision === 'approved') {
        // SECURITY: only an active student can be enrolled, whatever the request says.
        if (student?.role !== 'student' || student.status !== 'active') {
          throw new AppError('validation', CANNOT_ENROL_MESSAGE)
        }
        // Enrol them, unless they got in another way meanwhile.
        const already = data.enrollments.some(
          (enrollment) => enrollment.courseId === course.id && enrollment.studentId === student.id,
        )
        if (!already) data.enrollments.push({ courseId: course.id, studentId: student.id })
        // Close the request, then record both facts.
        request.status = 'approved'
        request.decidedAt = now().toISOString()
        request.decidedBy = actor
        record(actor, 'enrollment_request.approved', course, {
          studentId: request.studentId,
          requestId: request.id,
        })
        if (!already) record(actor, 'enrollment.added', course, { studentId: request.studentId })
        return
      }

      // Declined: close it, and enrol nobody.
      request.status = 'declined'
      request.decidedAt = now().toISOString()
      request.decidedBy = actor
      record(actor, 'enrollment_request.declined', course, {
        studentId: request.studentId,
        requestId: request.id,
      })
    },
  }
}
