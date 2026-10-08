/**
 * The Users list's filters, kept in the address so a filtered view can be shared and survives a
 * refresh (admin REQUIREMENTS section 11). Reading checks every value, since anyone can edit an
 * address by hand.
 */

// The shared vocabulary.
import type { AccountStatus, Role } from '@conote/domain'

// The filter shape.
import type { UserFilter, UserSort } from '@/types/users'

/** The tab names in the address, and the role each shows. */
const TABS = {
  students: 'student',
  teachers: 'teacher',
  admins: 'admin',
} as const satisfies Record<string, Role>

/** The tab name for each role. */
const TAB_FOR_ROLE: Record<Role, keyof typeof TABS> = {
  student: 'students',
  teacher: 'teachers',
  admin: 'admins',
}

/** The statuses a filter may name. */
const STATUSES: readonly AccountStatus[] = ['active', 'inactive', 'suspended', 'pending']

/** The sorts the list knows. */
const SORTS: readonly UserSort[] = [
  'name',
  '-name',
  'created',
  '-created',
  'lastActive',
  '-lastActive',
]

/** Roles, for the dashboard's `role=` links. */
const ROLES: readonly Role[] = ['student', 'teacher', 'admin']

/** `value` if it is one of `allowed`, otherwise undefined. */
function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return allowed.find((candidate) => candidate === value)
}

/** The tab's address name for `role`. */
export function tabForRole(role: Role): string {
  return TAB_FOR_ROLE[role]
}

/** The filter in `params`. SECURITY: unknown values are dropped, never passed on. */
export function readUserFilter(params: URLSearchParams): UserFilter {
  // The tab, or the dashboard's role link, or students.
  const tab = params.get('tab')
  const role =
    (tab !== null && tab in TABS ? TABS[tab as keyof typeof TABS] : undefined) ??
    oneOf(ROLES, params.get('role')) ??
    'student'
  // A positive whole page number, or 1.
  const page = Number(params.get('page'))
  // Every other filter, when present and valid.
  const q = params.get('q')?.trim()
  const filter: UserFilter = { role, page: Number.isInteger(page) && page > 0 ? page : 1 }
  if (q) filter.q = q
  const status = oneOf(STATUSES, params.get('status'))
  if (status) filter.status = status
  const department = params.get('department')?.trim()
  if (department) filter.department = department
  const courseId = params.get('course')?.trim()
  if (courseId) filter.courseId = courseId
  const sort = oneOf(SORTS, params.get('sort'))
  if (sort) filter.sort = sort
  return filter
}

/** `filter` as address parameters, leaving out the defaults so the address stays short. */
export function writeUserFilter(filter: UserFilter): Record<string, string> {
  // Each parameter that differs from its default.
  const params: Record<string, string> = {}
  if (filter.role !== 'student') params.tab = TAB_FOR_ROLE[filter.role]
  if (filter.q) params.q = filter.q
  if (filter.status) params.status = filter.status
  if (filter.department) params.department = filter.department
  if (filter.courseId) params.course = filter.courseId
  if (filter.sort) params.sort = filter.sort
  if (filter.page && filter.page > 1) params.page = String(filter.page)
  return params
}

/** True when the search or any filter is set (the tab, sort and page don't count). */
export function hasUserFilters(filter: UserFilter): boolean {
  return [filter.q, filter.status, filter.department, filter.courseId].some(Boolean)
}
