/**
 * The demo UserService (admin REQUIREMENTS section 11): the accounts in the demo platform,
 * searched, filtered and changed the way the database and Edge Functions will. Every change
 * writes an audit entry, and `onChange` lets the app save the platform so changes survive a
 * reload.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'
// The shared vocabulary.
import type { AccountStatus } from '@conote/domain'
// The schema type the form rules share.
import type { ZodType } from 'zod'

// The form rules, enforced here too.
import { editUserSchema, inviteUserSchema } from '@/lib/userSchemas'
// The status rules.
import { canChangeStatus, canSendPasswordReset } from '@/lib/userStatus'
// User shapes.
import type {
  CourseRef,
  StatusChange,
  UserDetails,
  UserFilter,
  UserListItem,
  UserSort,
} from '@/types/users'

// The records it reads and writes.
import type { AuditEntry, PlatformData, UserRecord } from '../platformData'
// The interface implemented here.
import type { UserService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'

/** How many accounts a page holds. */
export const USER_PAGE_SIZE = 20

/** What the demo service needs. */
interface MockUserOptions {
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

/** Compares two optional times for sorting; a missing time sorts after every real one. */
function compareTimes(a: string | null, b: string | null, descending: boolean) {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return descending ? b.localeCompare(a) : a.localeCompare(b)
}

/** The comparison for each sort. */
function comparator(sort: UserSort): (a: UserRecord, b: UserRecord) => number {
  // "-" in front means newest or Z first.
  const descending = sort.startsWith('-')
  const field = descending ? sort.slice(1) : sort
  if (field === 'created') return (a, b) => compareTimes(a.createdAt, b.createdAt, descending)
  if (field === 'lastActive') {
    return (a, b) => compareTimes(a.lastActiveAt, b.lastActiveAt, descending)
  }
  // By name, ignoring case and accents.
  return (a, b) =>
    (descending ? -1 : 1) * a.fullName.localeCompare(b.fullName, 'en', { sensitivity: 'base' })
}

/** Builds the demo UserService over `data`. */
export function createMockUserService({
  data,
  now,
  actorId,
  latencyMs,
  onChange,
}: MockUserOptions): UserService {
  /** The courses in use, by ID. */
  function activeCourses() {
    return new Map(
      data.courses
        .filter((course) => course.archivedAt === null)
        .map((course) => [course.id, course]),
    )
  }

  /** The courses in use that `user` is enrolled in (students) or teaches (teachers). */
  function coursesOf(user: UserRecord): CourseRef[] {
    // The courses in use.
    const courses = activeCourses()
    // A teacher's courses.
    if (user.role === 'teacher') {
      return [...courses.values()]
        .filter((course) => course.teacherId === user.id)
        .map(({ id, code, title }) => ({ id, code, title }))
    }
    // A student's enrolments; administrators have none.
    return data.enrollments
      .filter((enrollment) => enrollment.studentId === user.id)
      .flatMap((enrollment) => {
        const course = courses.get(enrollment.courseId)
        return course ? [{ id: course.id, code: course.code, title: course.title }] : []
      })
  }

  /** The IDs of a course's students, or of its teacher when listing teachers. */
  function membersOf(courseId: string, role: UserFilter['role']): Set<string | null> {
    // The teacher who teaches it.
    if (role === 'teacher') {
      return new Set(data.courses.filter((c) => c.id === courseId).map((c) => c.teacherId))
    }
    // The students enrolled in it.
    return new Set(data.enrollments.filter((e) => e.courseId === courseId).map((e) => e.studentId))
  }

  /** The list row for `user`. */
  function toListItem(user: UserRecord): UserListItem {
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      fullName: user.fullName,
      email: user.email,
      studentNumber: user.studentNumber,
      staffNumber: user.staffNumber,
      department: user.department,
      courseCount: coursesOf(user).length,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    }
  }

  /** `user`'s status history, oldest first, from the audit log. */
  function historyOf(user: UserRecord): StatusChange[] {
    // Names of everyone who might have made a change.
    const names = new Map(data.users.map((candidate) => [candidate.id, candidate.fullName]))
    return data.auditLog
      .filter(
        (entry) =>
          entry.entityType === 'user' &&
          entry.entityId === user.id &&
          (entry.action === 'user.invited' || entry.action === 'user.status_changed'),
      )
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((entry) => ({
        // An invitation starts the account as pending; a change names its new status.
        status: (entry.metadata.to ?? entry.metadata.status ?? 'pending') as AccountStatus,
        at: entry.at,
        // A change the account made itself (signing in for the first time) has no "by".
        byName:
          entry.actorId && entry.actorId !== user.id ? (names.get(entry.actorId) ?? null) : null,
      }))
  }

  /** The details page for `user`. */
  function toDetails(user: UserRecord): UserDetails {
    return {
      ...toListItem(user),
      level: user.level,
      phone: user.phone,
      courses: coursesOf(user),
      statusHistory: historyOf(user),
    }
  }

  /** The account with `userId`, or a not-found error. */
  function find(userId: string): UserRecord {
    const user = data.users.find((candidate) => candidate.id === userId)
    if (!user) throw new AppError('not_found', 'User not found.')
    return user
  }

  /** The signed-in administrator's ID. SECURITY: no change is made without one. */
  function requireActor(): string {
    const id = actorId()
    if (!id) throw new AppError('unauthorized', 'Sign in again to continue.')
    return id
  }

  /** Appends an audit entry for `user`, then reports the change. */
  function record(
    actor: string,
    action: string,
    user: UserRecord,
    metadata: AuditEntry['metadata'],
  ) {
    // SECURITY: an append-only trail of who changed what; never note content.
    data.auditLog.push({
      id: `audit-${crypto.randomUUID()}`,
      at: now().toISOString(),
      actorId: actor,
      action,
      entityType: 'user',
      entityId: user.id,
      metadata,
    })
    // Let the app save the platform.
    onChange?.()
  }

  return {
    async listUsers(filter: UserFilter) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // The search, in lower case, and the course's members.
      const q = filter.q?.trim().toLowerCase()
      const inCourse = filter.courseId ? membersOf(filter.courseId, filter.role) : null
      // The matching accounts, sorted.
      const matches = data.users
        .filter(
          (user) =>
            user.role === filter.role &&
            (!filter.status || user.status === filter.status) &&
            (!filter.department || user.department === filter.department) &&
            (!inCourse || inCourse.has(user.id)) &&
            (!q ||
              [user.fullName, user.email, user.studentNumber, user.staffNumber].some((field) =>
                field?.toLowerCase().includes(q),
              )),
        )
        .sort(comparator(filter.sort ?? 'name'))
      // The requested page; past the end shows the last page.
      const lastPage = Math.max(1, Math.ceil(matches.length / USER_PAGE_SIZE))
      const page = Math.min(Math.max(1, filter.page ?? 1), lastPage)
      const start = (page - 1) * USER_PAGE_SIZE
      return {
        items: matches.slice(start, start + USER_PAGE_SIZE).map(toListItem),
        total: matches.length,
        page,
        pageSize: USER_PAGE_SIZE,
      }
    },

    async listFilterOptions() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Every department in use, A to Z.
      const departments = [
        ...new Set(data.users.flatMap((user) => (user.department ? [user.department] : []))),
      ].sort((a, b) => a.localeCompare(b))
      // The courses in use, by code.
      const courses = [...activeCourses().values()]
        .map(({ id, code, title }) => ({ id, code, title }))
        .sort((a, b) => a.code.localeCompare(b.code))
      return { departments, courses }
    },

    async getUser(userId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      return toDetails(find(userId))
    },

    async inviteUser(input) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is inviting, and whether the details are valid.
      const actor = requireActor()
      const values = parseOrThrow(inviteUserSchema, input)
      // One account per email.
      if (data.users.some((user) => user.email.toLowerCase() === values.email)) {
        throw new AppError('conflict', 'An account with this email already exists.')
      }
      // A pending account: the invitation email (sent by Supabase Auth later) lets them sign in.
      const user: UserRecord = {
        id: `user-${crypto.randomUUID()}`,
        role: values.role,
        status: 'pending',
        fullName: values.fullName,
        email: values.email,
        studentNumber: null,
        staffNumber: null,
        department: values.role === 'admin' ? null : (values.department ?? null),
        level: null,
        phone: null,
        createdAt: now().toISOString(),
        lastActiveAt: null,
      }
      data.users.push(user)
      record(actor, 'user.invited', user, { role: user.role, status: 'pending' })
      return toDetails(user)
    },

    async updateUser(userId, input) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is editing, which account, and whether the changes are valid.
      const actor = requireActor()
      const user = find(userId)
      const values = parseOrThrow(editUserSchema, input)
      // Apply the changes.
      Object.assign(user, values)
      record(actor, 'user.updated', user, { fields: Object.keys(values).join(',') })
      return toDetails(user)
    },

    async setUserStatus(userId, status) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is changing it, and which account.
      const actor = requireActor()
      const user = find(userId)
      // SECURITY: an administrator can't deactivate or suspend themselves and lose access.
      if (user.id === actor) {
        throw new AppError('validation', "You can't change your own account's status.")
      }
      // Only the changes the rules allow.
      if (!canChangeStatus(user.status, status)) {
        throw new AppError('validation', 'This status change isn’t allowed.')
      }
      // Apply and record. The backend also revokes the account's sessions at this point.
      const from = user.status
      user.status = status
      record(actor, 'user.status_changed', user, { from, to: status })
      return toDetails(user)
    },

    async sendPasswordReset(userId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Who is sending it, and to whom.
      const actor = requireActor()
      const user = find(userId)
      // Only active accounts can sign in, so only they get a link.
      if (!canSendPasswordReset(user.status)) {
        throw new AppError('validation', 'Only active accounts can be sent a reset link.')
      }
      // The demo sends no email; it records that one would have been sent.
      record(actor, 'user.password_reset_sent', user, {})
    },
  }
}
