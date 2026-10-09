/**
 * The Courses list's filters, kept in the address so a filtered view can be shared and survives a
 * refresh (admin REQUIREMENTS section 12). Reading checks every value, since anyone can edit an
 * address by hand.
 */

// The shared vocabulary.
import type { CourseStatus } from '@conote/domain'

// The filter shape.
import type { CourseFilter, CourseSort } from '@/types/courses'

/** The statuses a filter may name. */
const STATUSES: readonly CourseStatus[] = ['upcoming', 'ongoing', 'completed']

/** The sorts the list knows. */
const SORTS: readonly CourseSort[] = ['code', '-code', 'title', '-title', 'students', '-students']

/** `value` if it is one of `allowed`, otherwise undefined. */
function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return allowed.find((candidate) => candidate === value)
}

/** The filter in `params`. SECURITY: unknown values are dropped, never passed on. */
export function readCourseFilter(params: URLSearchParams): CourseFilter {
  // A positive whole page number, or 1.
  const page = Number(params.get('page'))
  const filter: CourseFilter = { page: Number.isInteger(page) && page > 0 ? page : 1 }
  // Every other filter, when present and valid.
  const q = params.get('q')?.trim()
  if (q) filter.q = q
  const status = oneOf(STATUSES, params.get('status'))
  if (status) filter.status = status
  const department = params.get('department')?.trim()
  if (department) filter.department = department
  const teacher = params.get('teacher')?.trim()
  if (teacher) filter.teacher = teacher
  // Only the exact word turns on the archived view.
  if (params.get('archived') === 'true') filter.archived = true
  const sort = oneOf(SORTS, params.get('sort'))
  if (sort) filter.sort = sort
  return filter
}

/** `filter` as address parameters, leaving out the defaults so the address stays short. */
export function writeCourseFilter(filter: CourseFilter): Record<string, string> {
  // Each parameter that differs from its default.
  const params: Record<string, string> = {}
  if (filter.q) params.q = filter.q
  if (filter.status) params.status = filter.status
  if (filter.department) params.department = filter.department
  if (filter.teacher) params.teacher = filter.teacher
  if (filter.archived) params.archived = 'true'
  if (filter.sort) params.sort = filter.sort
  if (filter.page && filter.page > 1) params.page = String(filter.page)
  return params
}

/** True when the search or any filter is set (the archived view, sort and page don't count). */
export function hasCourseFilters(filter: CourseFilter): boolean {
  return [filter.q, filter.status, filter.department, filter.teacher].some(Boolean)
}
