/**
 * What the admin real-backend tests share: reading their settings, loading a contract's small
 * platform into a local Supabase stack, and translating between the contract's short IDs ("c1",
 * "t1") and the UUIDs the database uses. Used only by tests that run against the throwaway local
 * stack (the last step of the "Supabase contract tests" job); never import it from app code.
 *
 * SECURITY: loading a platform first EMPTIES the stack's accounts and courses, so the harness
 * refuses to run against anything but a local address.
 */

// The SDK, to talk to the stack as the server and as the administrator.
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js'

// The records a contract builds, and the builders for the stand-ins it may need.
import {
  classRecord,
  courseRecord,
  userRecord,
  type PlatformData,
  type UserRecord,
} from '../platformData'

/** A setting from the environment, or undefined when it is missing or empty. */
function setting(name: string): string | undefined {
  // Vitest exposes only VITE_-prefixed variables to tests.
  const value: unknown = import.meta.env[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

// The stack to test against.
export const URL = setting('VITE_SUPABASE_TEST_URL')
export const ANON_KEY = setting('VITE_SUPABASE_TEST_ANON_KEY')
export const SERVICE_KEY = setting('VITE_SUPABASE_TEST_SERVICE_KEY')

/** True when every setting the suites need is present; otherwise they are skipped. */
export const CONFIGURED = Boolean(URL && ANON_KEY && SERVICE_KEY)

// The password every account the harness creates gets.
const PASSWORD = `Harness-${Math.random().toString(36).slice(2, 10)}-2026`

/** Storage that lives only in memory, so tests never touch the browser's. */
function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
  }
}

/** True for a plain object, so its fields can be walked. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The short IDs a contract uses, and the UUIDs the database knows them by. */
class IdMap {
  private readonly toUuid = new Map<string, string>()
  private readonly toShort = new Map<string, string>()

  /** The UUID for `short`, made the first time it is asked for. */
  uuid(short: string): string {
    let id = this.toUuid.get(short)
    if (id === undefined) {
      id = crypto.randomUUID()
      this.set(short, id)
    }
    return id
  }

  /** Records that `short` is the database's `id`. */
  set(short: string, id: string) {
    this.toUuid.set(short, id)
    this.toShort.set(id, short)
  }

  /** `value` with every known short ID replaced by its UUID, however deep. */
  down<T>(value: T): T {
    return this.walk(value, this.toUuid) as T
  }

  /** `value` with every known UUID replaced by its short ID, however deep. */
  up<T>(value: T): T {
    return this.walk(value, this.toShort) as T
  }

  /** Copies `value`, swapping each string found in `table`. */
  private walk(value: unknown, table: Map<string, string>): unknown {
    if (typeof value === 'string') return table.get(value) ?? value
    if (Array.isArray(value)) return value.map((item) => this.walk(item, table))
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.walk(item, table)]),
      )
    }
    return value
  }
}

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

/** A client with the server key, which bypasses Row Level Security. */
function serverClient(): SupabaseClient {
  const options: SupabaseClientOptions<'public'> = { auth: { persistSession: false } }
  const client = createClient(URL ?? '', SERVICE_KEY ?? '', options)
  return client
}

/** Throws unless a refused write to Supabase was none. */
function ok(result: { error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`)
}

/** Loads contract platforms into the stack and builds clients for them. */
/** How a harness treats the accounts between one load and the next. */
export interface HarnessOptions {
  // True: every load starts from no accounts at all, with new IDs, so what one test did to an
  // account (and what the audit log recorded about it) cannot reach the next. False: the accounts
  // are made once and reused, which is much faster.
  freshAccounts?: boolean
}

export class Harness {
  ids = new IdMap()
  private readonly server = serverClient()
  // Administrators already signed in, by short ID.
  private readonly clients = new Map<string, SupabaseClient>()
  private wiped = false
  private readonly freshAccounts: boolean

  constructor({ freshAccounts = false }: HarnessOptions = {}) {
    this.freshAccounts = freshAccounts
  }

  /** Empties the stack's accounts and courses: once, or before every load when accounts are fresh. */
  private async wipe() {
    if (this.wiped && !this.freshAccounts) return
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(URL ?? '')) {
      throw new Error('The admin harness empties the database; it runs only against a local stack.')
    }
    // Every course (classes, enrolments, requests, resources and summaries go with them).
    ok(
      await this.server.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      'wipe courses',
    )
    // Every account (their profiles go with them).
    const listed = await this.server.auth.admin.listUsers({ perPage: 1000 })
    await Promise.all(listed.data.users.map((user) => this.server.auth.admin.deleteUser(user.id)))
    // New accounts get new IDs, and nobody is signed in.
    if (this.freshAccounts) {
      this.ids = new IdMap()
      this.clients.clear()
    }
    this.wiped = true
  }

  /** Creates the accounts of `users` that do not exist yet. */
  private async ensureUsers(users: UserRecord[]) {
    await Promise.all(
      users
        .filter((user) => this.ids.down(user.id) === user.id)
        .map(async (user) => {
          const created = await this.server.auth.admin.createUser({
            email: user.email,
            password: PASSWORD,
            email_confirm: true,
          })
          const id = created.data.user?.id
          if (!id) throw new Error(`Could not create ${user.email}`)
          this.ids.set(user.id, id)
        }),
    )
  }

  /** Makes the stack hold exactly `source`'s accounts, courses and what hangs off them. */
  async load(source: PlatformData) {
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

  /** A client signed in as the account `short`, or one with no session when it is empty. */
  async clientFor(short: string, data: PlatformData): Promise<SupabaseClient> {
    const options: SupabaseClientOptions<'public'> = {
      auth: { storage: memoryStorage(), storageKey: `harness-${short}`, autoRefreshToken: false },
    }
    if (short === '') {
      const anonymous = createClient(URL ?? '', ANON_KEY ?? '', options)
      return anonymous
    }
    const cached = this.clients.get(short)
    if (cached) return cached
    const user = data.users.find((candidate) => candidate.id === short)
    if (!user) throw new Error(`The platform has no account ${short}`)
    const client = createClient(URL ?? '', ANON_KEY ?? '', options)
    const signedIn = await client.auth.signInWithPassword({ email: user.email, password: PASSWORD })
    if (signedIn.error) throw new Error(`Could not sign in as ${user.email}`)
    this.clients.set(short, client)
    return client
  }

  /**
   * Wraps a service so a contract can keep using its short IDs: arguments go down to UUIDs and
   * answers come back up to short IDs. The platform is loaded, and the service built, on the first
   * call, not when the wrapper is made: a contract may change `data` right after asking for the
   * service, and a service that is never called must not touch the database.
   */
  wrap<S extends object>(
    data: PlatformData,
    actorId: string,
    build: (client: SupabaseClient) => S,
  ): S {
    // Made on first use, then shared by every call.
    let ready: Promise<S> | undefined
    const start = () => {
      ready ??= (async () => {
        await this.load(data)
        return build(await this.clientFor(actorId, data))
      })()
      return ready
    }
    return new Proxy({} as S, {
      get: (_target, name) => {
        if (typeof name !== 'string') return undefined
        return async (...args: unknown[]) => {
          const service = (await start()) as Record<string, unknown>
          const method = service[name]
          if (typeof method !== 'function') throw new Error(`${name} is not a service method`)
          const result: unknown = await (method as (...a: unknown[]) => Promise<unknown>).apply(
            service,
            this.ids.down(args),
          )
          return this.ids.up(result)
        }
      },
    })
  }
}
