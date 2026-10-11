/**
 * What the admin real-backend tests share: reading their settings and loading a contract's small
 * platform into a local Supabase stack. The ID translation, the signed-in clients and the local-only
 * check are shared with the other apps (`@conote/testing/integrationSupport`). Used only by tests
 * that run against the throwaway local stack (the last step of the "Supabase contract tests" job);
 * never import it from app code.
 *
 * SECURITY: loading a platform first EMPTIES the stack's accounts and courses, so the harness
 * refuses to run against anything but a local address.
 */

// The shared harness: settings, ID translation and signed-in clients.
import {
  StackHarness,
  ok,
  readStackSettings,
  type HarnessOptions,
} from '@conote/testing/integrationSupport'

// The records a contract builds, and the builders for the stand-ins it may need.
import { classRecord, courseRecord, userRecord, type PlatformData } from '../platformData'

// The stack to test against, from the environment.
const SETTINGS = readStackSettings(import.meta.env)
export const URL = SETTINGS.url
export const ANON_KEY = SETTINGS.anonKey
export const SERVICE_KEY = SETTINGS.serviceKey

/** True when every setting the suites need is present; otherwise they are skipped. */
export const CONFIGURED = SETTINGS.configured

/** The administrator the dashboard contracts act as, for platforms that have none of their own. */
export const HARNESS_ADMIN = userRecord({
  id: 'harness-admin',
  role: 'admin',
  fullName: 'Harness Admin',
})

/** `data` with the harness administrator added, so a contract that names no actor can sign in. */
export function withAdmin(data: PlatformData): PlatformData {
  return { ...data, users: [...data.users, HARNESS_ADMIN] }
}

/**
 * `data` plus stand-ins for what its records point at but do not describe. The dashboard contracts
 * list jobs and summaries for classes that do not exist, and requests from students who are not
 * listed; the database requires them to exist. The stand-in classes are archived inside an
 * archived course, so they change none of the counts a contract checks.
 */
function withStubs(data: PlatformData): PlatformData {
  const knownClasses = new Set(data.classes.map((item) => item.id))
  const knownUsers = new Set(data.users.map((user) => user.id))
  const wantedClasses = new Set([
    ...data.summaries.map((summary) => summary.classId),
    ...data.aiJobs.map((job) => job.classId),
  ])
  const wantedUsers = new Set([
    ...data.enrollments.map((enrollment) => enrollment.studentId),
    ...data.enrollmentRequests.map((request) => request.studentId),
  ])
  // Teachers the courses name but the records do not describe (a course in a contract may name
  // "t1" without listing a person), who must exist for the course to be saved.
  const wantedTeachers = new Set(
    data.courses.flatMap((course) => (course.teacherId === null ? [] : [course.teacherId])),
  )
  const missingClasses = [...wantedClasses].filter((id) => !knownClasses.has(id))
  const missingUsers = [...wantedUsers].filter((id) => !knownUsers.has(id))
  const missingTeachers = [...wantedTeachers].filter(
    (id) => !knownUsers.has(id) && !missingUsers.includes(id),
  )
  if (missingClasses.length === 0 && missingUsers.length === 0 && missingTeachers.length === 0) {
    return data
  }
  const stubCourse = courseRecord({
    id: 'harness-stub-course',
    code: 'STUB 000',
    title: 'Stand-in',
    archivedAt: '2000-01-02T00:00:00.000Z',
  })
  return {
    ...data,
    users: [
      ...data.users,
      ...missingUsers.map((id) => userRecord({ id, role: 'student' })),
      ...missingTeachers.map((id) => userRecord({ id, role: 'teacher' })),
    ],
    courses: missingClasses.length > 0 ? [...data.courses, stubCourse] : data.courses,
    classes: [
      ...data.classes,
      ...missingClasses.map((id, index) =>
        classRecord({
          id,
          courseId: stubCourse.id,
          number: index + 1,
          title: id,
          startsAt: '2000-01-01T09:00:00.000Z',
          endsAt: '2000-01-01T10:00:00.000Z',
          archivedAt: '2000-01-02T00:00:00.000Z',
        }),
      ),
    ],
  }
}

/** Loads the admin contracts' platforms into the stack and builds clients for them. */
export class Harness extends StackHarness<PlatformData> {
  constructor(options: HarnessOptions = {}) {
    super(SETTINGS, options)
  }

  /** Makes the stack hold exactly `source`'s accounts, courses and what hangs off them. */
  protected async load(source: PlatformData) {
    const data = withStubs(source)
    await this.wipe()
    // The activity and failure logs start empty, and the settings are the platform's.
    const nobody = '00000000-0000-0000-0000-000000000000'
    for (const table of [
      'activity_events',
      'security_events',
      'delivery_failures',
      'storage_errors',
    ]) {
      ok(await this.server.from(table).delete().neq('id', nobody), `clear ${table}`)
    }
    ok(
      await this.server
        .from('platform_settings')
        .update({
          term_starts_on: data.settings.termStartsOn,
          term_ends_on: data.settings.termEndsOn,
          review_alert_days: data.settings.reviewAlertDays,
        })
        .eq('id', true),
      'settings',
    )
    await this.ensureUsers(data.users)
    // The accounts as the contract describes them now.
    ok(
      await this.server.from('profiles').upsert(
        data.users.map((user) => ({
          id: this.ids.uuid(user.id),
          email: user.email,
          role: user.role,
          // A course can only be given an active teacher, so a teacher who is inactive in the
          // records is made active here and switched off again once the courses are in.
          status: user.role === 'teacher' ? 'active' : user.status,
          full_name: user.fullName,
          student_number: user.studentNumber,
          staff_number: user.staffNumber,
          department: user.department,
          level: user.level,
          phone: user.phone,
          created_at: user.createdAt,
          last_active_at: user.lastActiveAt,
        })),
      ),
      'profiles',
    )
    // Start the courses from nothing, then add the contract's.
    ok(
      await this.server.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      'courses',
    )
    const id = (short: string) => this.ids.uuid(short)
    ok(
      await this.server.from('courses').insert(
        data.courses.map((course) => ({
          id: id(course.id),
          code: course.code,
          title: course.title,
          description: course.description,
          department: course.department,
          status: course.status,
          teacher_id: course.teacherId === null ? null : id(course.teacherId),
          created_at: course.createdAt,
          archived_at: course.archivedAt,
        })),
      ),
      'insert courses',
    )
    for (const user of data.users) {
      if (user.role === 'teacher' && user.status !== 'active') {
        ok(
          await this.server.from('profiles').update({ status: user.status }).eq('id', id(user.id)),
          'teacher status',
        )
      }
    }
    if (data.auditLog.length > 0) {
      const roleOf = new Map(data.users.map((user) => [user.id, user.role]))
      ok(
        await this.server.from('audit_logs').insert(
          data.auditLog.map((entry) => ({
            id: id(entry.id),
            created_at: entry.at,
            actor_id: entry.actorId === null ? null : id(entry.actorId),
            actor_role: entry.actorId === null ? null : (roleOf.get(entry.actorId) ?? null),
            action: entry.action,
            entity_type: entry.entityType,
            entity_id: entry.entityType === 'user' ? id(entry.entityId) : entry.entityId,
            metadata: entry.metadata,
          })),
        ),
        'insert audit entries',
      )
    }
    if (data.enrollments.length > 0) {
      ok(
        await this.server.from('enrollments').insert(
          data.enrollments.map((row) => ({
            course_id: id(row.courseId),
            student_id: id(row.studentId),
          })),
        ),
        'insert enrollments',
      )
    }
    if (data.classes.length > 0) {
      // A course keeps the numbers its records carry when they differ; records that repeat a
      // number (the course contract's defaults) are numbered in time order instead.
      const ordered = [...data.classes].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      const counters = new Map<string, number>()
      // Each course's numbers, to see whether any repeat.
      const numbers = new Map<string, number[]>()
      for (const item of data.classes) {
        numbers.set(item.courseId, [...(numbers.get(item.courseId) ?? []), item.number])
      }
      const distinct = new Map(
        [...numbers].map(([courseId, list]) => [courseId, new Set(list).size === list.length]),
      )
      ok(
        await this.server.from('class_sessions').insert(
          ordered.map((item) => {
            const next = (counters.get(item.courseId) ?? 0) + 1
            counters.set(item.courseId, next)
            return {
              id: id(item.id),
              course_id: id(item.courseId),
              number: distinct.get(item.courseId) ? item.number : next,
              title: item.title,
              description: item.description,
              starts_at: item.startsAt,
              // The database refuses a class that ends before it starts, and the contract's
              // records keep a default end time; such a class gets an hour.
              ends_at:
                item.endsAt > item.startsAt
                  ? item.endsAt
                  : new Date(Date.parse(item.startsAt) + 3_600_000).toISOString(),
              archived_at: item.archivedAt,
            }
          }),
        ),
        'insert classes',
      )
      // Notes are private, and the console only counts them: the record's count becomes that many
      // notes, written by the students in turn.
      const students = data.users.filter((user) => user.role === 'student')
      const notes = data.classes.flatMap((item) =>
        Array.from({ length: item.noteCount }, (_unused, index) => ({
          student_id: id(students[index % Math.max(students.length, 1)]?.id ?? ''),
          course_id: id(item.courseId),
          class_id: id(item.id),
          title: `Note ${String(index + 1)}`,
        })),
      )
      if (notes.length > 0) ok(await this.server.from('notes').insert(notes), 'insert notes')
    }
    if (data.summaries.length > 0) {
      const courseOf = new Map(data.classes.map((item) => [item.id, item.courseId]))
      ok(
        await this.server.from('summaries').insert(
          data.summaries.map((summary) => ({
            id: id(summary.id),
            class_id: id(summary.classId),
            course_id: id(courseOf.get(summary.classId) ?? ''),
            status: summary.status,
            in_review_since: summary.inReviewSince,
            published_at: summary.publishedAt,
          })),
        ),
        'insert summaries',
      )
    }
    if (data.aiJobs.length > 0) {
      const courseOfClass = new Map(data.classes.map((item) => [item.id, item.courseId]))
      ok(
        await this.server.from('ai_jobs').insert(
          data.aiJobs.map((job) => ({
            id: id(job.id),
            class_id: id(job.classId),
            course_id: id(courseOfClass.get(job.classId) ?? ''),
            status: job.status,
            attempt: job.attempt,
            created_at: job.createdAt,
            finished_at: job.finishedAt,
          })),
        ),
        'insert jobs',
      )
    }
    if (data.resources.length > 0) {
      ok(
        await this.server.from('resources').insert(
          data.resources.map((resource) => ({
            id: id(resource.id),
            title: resource.title,
            type: resource.type,
            url: 'https://example.com/material',
            course_id: id(resource.courseId),
            class_id: resource.classId === null ? null : id(resource.classId),
            status: resource.status,
            created_at: resource.createdAt,
          })),
        ),
        'insert resources',
      )
    }
    if (data.enrollmentRequests.length > 0) {
      ok(
        await this.server.from('enrollment_requests').insert(
          data.enrollmentRequests.map((request) => ({
            id: id(request.id),
            course_id: id(request.courseId),
            student_id: id(request.studentId),
            status: request.status,
            created_at: request.createdAt,
            decided_at: request.decidedAt,
            decided_by: request.decidedBy === null ? null : id(request.decidedBy),
          })),
        ),
        'insert requests',
      )
    }

    if (data.activity.length > 0) {
      ok(
        await this.server
          .from('activity_events')
          .insert(data.activity.map((event) => ({ kind: event.kind, created_at: event.at }))),
        'insert activity',
      )
    }
    if (data.deliveryFailures.length > 0) {
      ok(
        await this.server
          .from('delivery_failures')
          .insert(data.deliveryFailures.map((item) => ({ id: id(item.id), created_at: item.at }))),
        'insert delivery failures',
      )
    }
    if (data.storageErrors.length > 0) {
      ok(
        await this.server
          .from('storage_errors')
          .insert(data.storageErrors.map((item) => ({ id: id(item.id), created_at: item.at }))),
        'insert storage errors',
      )
    }
    if (data.securityEvents.length > 0) {
      ok(
        await this.server.from('security_events').insert(
          data.securityEvents.map((item) => ({
            id: id(item.id),
            action: item.action,
            created_at: item.at,
          })),
        ),
        'insert security events',
      )
    }
  }
}
