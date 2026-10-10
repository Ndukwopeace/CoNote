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

// The records a contract builds.
import type { PlatformData, UserRecord } from '../platformData'

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
export class Harness {
  readonly ids = new IdMap()
  private readonly server = serverClient()
  // Administrators already signed in, by short ID.
  private readonly clients = new Map<string, SupabaseClient>()
  private wiped = false

  /** Empties the stack's accounts and courses, once. SECURITY: only ever a local stack. */
  private async wipe() {
    if (this.wiped) return
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
    for (const user of listed.data.users) {
      await this.server.auth.admin.deleteUser(user.id)
    }
    this.wiped = true
  }

  /** Creates the accounts of `users` that do not exist yet. */
  private async ensureUsers(users: UserRecord[]) {
    for (const user of users) {
      if (this.ids.down(user.id) !== user.id) continue
      const created = await this.server.auth.admin.createUser({
        email: user.email,
        password: PASSWORD,
        email_confirm: true,
      })
      const id = created.data.user?.id
      if (!id) throw new Error(`Could not create ${user.email}`)
      this.ids.set(user.id, id)
    }
  }

  /** Makes the stack hold exactly `data`'s accounts, courses and what hangs off them. */
  async load(data: PlatformData) {
    await this.wipe()
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
