/**
 * The admin UserService on Supabase (milestone B2.7, D86): the accounts of every role, their
 * history, and the changes an administrator can make. Reading goes through a view only an
 * administrator can see. Inviting, changing a status and sending a password link go through Edge
 * Functions, because they need the server key and Supabase Auth; editing a profile goes through a
 * database function that checks the caller. Each of those writes the audit entry the history is
 * read from.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The shared vocabulary.
import type { AccountStatus } from '@conote/domain'
// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Turns database failures into AppErrors.
import { fromSupabaseError } from '@conote/supabase/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'
// Reads and checks rows.
import { readOne, readRows } from '@conote/supabase/rows'

// The form rules, enforced here too.
import { editUserSchema, inviteUserSchema } from '@/lib/userSchemas'
// User shapes.
import type {
  CourseRef,
  StatusChange,
  UserDetails,
  UserFilter,
  UserListItem,
  UserSort,
} from '@/types/users'

// The interface this implementation must satisfy.
import type { UserService } from '../types'

// Calling the Edge Functions.
import { invokeThrough, unwrap, type InvokeFunction } from './functionCall'
// Errors from the database, with the code the rules below rely on.
import { databaseCode } from './databaseErrors'
// Search text, times and names.
import { compareText, iso, safeSearch } from './queryText'

/** The list's column for each sort field. */
const SORT_COLUMNS: Record<string, string> = {
  name: 'full_name',
  created: 'created_at',
  lastActive: 'last_active_at',
}

/** How many accounts a page holds. */
const PAGE_SIZE = 20

// The columns of the list view the service reads.
const USER_COLUMNS =
  'id, role, status, full_name, email, student_number, staff_number, department, level, phone, created_at, last_active_at, course_ids, course_count'

// SECURITY: each shape is checked on arrival, so a role or status the app does not know is
// refused instead of reaching a screen.
const statusSchema = z.enum(['active', 'inactive', 'suspended', 'pending'])
const userRow = z.object({
  id: z.string(),
  role: z.enum(['student', 'teacher', 'admin']),
  status: statusSchema,
  full_name: z.string(),
  email: z.string(),
  student_number: z.string().nullable(),
  staff_number: z.string().nullable(),
  department: z.string().nullable(),
  level: z.string().nullable(),
  phone: z.string().nullable(),
  created_at: z.string(),
  last_active_at: z.string().nullable(),
  course_ids: z.array(z.string()),
  course_count: z.number(),
})
// A course in use, as the user screens name it.
const courseRow = z.object({ id: z.string(), code: z.string(), title: z.string() })
// A department, from the departments view.
const departmentRow = z.object({ department: z.string() })
// One entry of an account's status history, from the audit log.
const historyRow = z.object({
  actor_id: z.string().nullable(),
  action: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
})
// An administrator's name, for "changed by".
const nameRow = z.object({ id: z.string(), full_name: z.string() })
// What an invitation answers with.
const invitedSchema = z.object({ userId: z.string() })

type UserRow = z.infer<typeof userRow>

/** What the service needs. */
interface SupabaseUserOptions {
  // The one client the console uses.
  client: SupabaseClient
  // How a function is called. Tests pass their own; the app goes through the client.
  invoke?: InvokeFunction
}

/** The account as a list row. */
function toListItem(row: UserRow): UserListItem {
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    fullName: row.full_name,
    email: row.email,
    studentNumber: row.student_number,
    staffNumber: row.staff_number,
    department: row.department,
    courseCount: row.course_count,
    createdAt: iso(row.created_at),
    lastActiveAt: row.last_active_at === null ? null : iso(row.last_active_at),
  }
}

/** Throws the validation error a form shows if `value` breaks `schema`. */
function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError('validation', result.error.issues[0]?.message ?? 'Check the details.')
  }
  return result.data
}

/** Builds the Supabase UserService. */
export function createSupabaseUserService({
  client,
  invoke = invokeThrough(client),
}: SupabaseUserOptions): UserService {
  /** The filtered list query; `head` asks only for the count. */
  function listQuery(filter: UserFilter, columns: string, head: boolean) {
    // Count every match, whichever page is asked for.
    let query = client
      .from('admin_users')
      .select(columns, { count: 'exact', head })
      .eq('role', filter.role)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.department) query = query.eq('department', filter.department)
    // Students enrolled in the course, or the teacher who teaches it.
    if (filter.courseId) query = query.contains('course_ids', [filter.courseId])
    const q = safeSearch(filter.q)
    if (q) {
      query = query.or(
        `full_name.ilike.%${q}%,email.ilike.%${q}%,student_number.ilike.%${q}%,staff_number.ilike.%${q}%`,
      )
    }
    return query
  }

  /** One account's list row, or not_found. */
  async function findRow(userId: string): Promise<UserRow> {
    // SECURITY: an ID that is not a UUID never reaches a query.
    if (!isUuid(userId)) throw new AppError('not_found', 'User not found.')
    const row = await readOne(
      client.from('admin_users').select(USER_COLUMNS).eq('id', userId).maybeSingle(),
      userRow,
    )
    if (!row) throw new AppError('not_found', 'User not found.')
    return row
  }

  /** The courses in use among `ids`, by code. */
  async function coursesIn(ids: string[]): Promise<CourseRef[]> {
    if (ids.length === 0) return []
    return readRows(
      client
        .from('admin_courses')
        .select('id, code, title')
        .in('id', ids)
        .is('archived_at', null)
        .order('code'),
      courseRow,
    )
  }

  /** `row`'s status history, oldest first, from the audit log. */
  async function historyOf(row: UserRow): Promise<StatusChange[]> {
    const entries = await readRows(
      client
        .from('audit_logs')
        .select('actor_id, action, metadata, created_at')
        .eq('entity_type', 'user')
        .eq('entity_id', row.id)
        .in('action', ['user.invited', 'user.status_changed'])
        .order('created_at'),
      historyRow,
    )
    // Names of everyone who made a change.
    const actors = [
      ...new Set(entries.flatMap((entry) => (entry.actor_id ? [entry.actor_id] : []))),
    ]
    const names = new Map<string, string>()
    if (actors.length > 0) {
      const people = await readRows(
        client.from('profiles').select('id, full_name').in('id', actors),
        nameRow,
      )
      for (const person of people) names.set(person.id, person.full_name)
    }
    return entries.map((entry) => {
      // An invitation starts the account as pending; a change names its new status.
      const named = statusSchema.safeParse(entry.metadata.to ?? entry.metadata.status)
      const status: AccountStatus = named.success ? named.data : 'pending'
      return {
        status,
        at: iso(entry.created_at),
        // A change the account made itself (accepting an invitation) has no "by".
        byName:
          entry.actor_id && entry.actor_id !== row.id ? (names.get(entry.actor_id) ?? null) : null,
      }
    })
  }

  /** The details page for the account in `row`. */
  async function toDetails(row: UserRow): Promise<UserDetails> {
    const [courses, statusHistory] = await Promise.all([coursesIn(row.course_ids), historyOf(row)])
    return { ...toListItem(row), level: row.level, phone: row.phone, courses, statusHistory }
  }

  return {
    async listUsers(filter) {
      // SECURITY: a course ID that is not a UUID matches nothing and never reaches a query.
      if (filter.courseId && !isUuid(filter.courseId)) {
        return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE }
      }
      // How many accounts match, so a page past the end can show the last page instead.
      const counted = await listQuery(filter, 'id', true)
      if (counted.error) throw fromSupabaseError(counted.error)
      const total = counted.count ?? 0
      const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
      const page = Math.min(Math.max(1, filter.page ?? 1), lastPage)
      // The sort: a field, "-" in front for descending. Accounts never active sort last either way.
      const sort: UserSort = filter.sort ?? 'name'
      const descending = sort.startsWith('-')
      const field = descending ? sort.slice(1) : sort
      const column = SORT_COLUMNS[field] ?? 'full_name'
      const start = (page - 1) * PAGE_SIZE
      const query = listQuery(filter, USER_COLUMNS, false).order(column, {
        ascending: !descending,
        nullsFirst: false,
      })
      // Past the last row there is nothing to ask for.
      const rows =
        total === 0 ? [] : await readRows(query.range(start, start + PAGE_SIZE - 1), userRow)
      return { items: rows.map(toListItem), total, page, pageSize: PAGE_SIZE }
    },

    async listFilterOptions() {
      const [departments, courses] = await Promise.all([
        readRows(client.from('admin_departments').select('department'), departmentRow),
        readRows(
          client.from('admin_courses').select('id, code, title').is('archived_at', null),
          courseRow,
        ),
      ])
      return {
        departments: departments.map((row) => row.department).toSorted(compareText),
        courses: courses.toSorted((a, b) => compareText(a.code, b.code)),
      }
    },

    async getUser(userId) {
      return toDetails(await findRow(userId))
    },

    async inviteUser(input) {
      // The form rules first, so a mistake costs no request.
      const values = parseOrThrow(inviteUserSchema, input)
      // The function checks the caller, creates the account, sends the email and records it.
      const answer = invitedSchema.parse(unwrap(await invoke('invite-user', values)))
      return toDetails(await findRow(answer.userId))
    },

    async updateUser(userId, input) {
      const row = await findRow(userId)
      const values = parseOrThrow(editUserSchema, input)
      // The database function checks the caller, saves the profile and records the edit.
      const { error } = await client.rpc('admin_update_profile', {
        p_user: row.id,
        p_full_name: values.fullName,
        p_department: values.department,
        p_level: values.level,
        p_phone: values.phone,
        p_student_number: values.studentNumber,
        p_staff_number: values.staffNumber,
      })
      if (error) {
        // A student or staff number belongs to one person.
        if (databaseCode(error) === '23505') {
          throw new AppError('conflict', 'That student or staff number is already in use.')
        }
        throw fromSupabaseError(error)
      }
      return toDetails(await findRow(row.id))
    },

    async setUserStatus(userId, status) {
      // SECURITY: an ID that is not a UUID never reaches the function.
      if (!isUuid(userId)) throw new AppError('not_found', 'User not found.')
      // The function holds the rules (no change to your own account, only the allowed moves).
      unwrap(await invoke('set-user-status', { userId, status }))
      return toDetails(await findRow(userId))
    },

    async sendPasswordReset(userId) {
      if (!isUuid(userId)) throw new AppError('not_found', 'User not found.')
      unwrap(await invoke('send-password-reset', { userId }))
    },
  }
}
