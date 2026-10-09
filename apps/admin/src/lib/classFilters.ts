/**
 * The Classes list's filters, kept in the address so a filtered view can be shared and survives a
 * refresh (admin REQUIREMENTS section 13). Reading checks every value, since anyone can edit an
 * address by hand.
 */

// The filter shape.
import type { ClassFilter, ClassSort, SummaryFilter } from '@/types/classes'

/** The summary stages a filter may name, and "none". */
const SUMMARY_FILTERS: readonly SummaryFilter[] = [
  'none',
  'collecting',
  'processing',
  'in_review',
  'published',
]

/** The sorts the list knows. */
const SORTS: readonly ClassSort[] = ['date', '-date', 'course', '-course', 'title', '-title']

/** A real calendar date written YYYY-MM-DD. */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return parsed.getMonth() === month - 1 && parsed.getDate() === day
}

/** `value` if it is one of `allowed`, otherwise undefined. */
function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return allowed.find((candidate) => candidate === value)
}

/** The filter in `params`. SECURITY: unknown values are dropped, never passed on. */
export function readClassFilter(params: URLSearchParams): ClassFilter {
  // A positive whole page number, or 1.
  const page = Number(params.get('page'))
  const filter: ClassFilter = { page: Number.isInteger(page) && page > 0 ? page : 1 }
  // Every other filter, when present and valid.
  const q = params.get('q')?.trim()
  if (q) filter.q = q
  const course = params.get('course')?.trim()
  if (course) filter.courseId = course
  const summary = oneOf(SUMMARY_FILTERS, params.get('summary'))
  if (summary) filter.summaryStatus = summary
  const from = params.get('from')
  if (from && isDate(from)) filter.from = from
  const to = params.get('to')
  if (to && isDate(to)) filter.to = to
  // Only the exact word turns on the archived view.
  if (params.get('archived') === 'true') filter.archived = true
  const sort = oneOf(SORTS, params.get('sort'))
  if (sort) filter.sort = sort
  return filter
}

/** `filter` as address parameters, leaving out the defaults so the address stays short. */
export function writeClassFilter(filter: ClassFilter): Record<string, string> {
  // Each parameter that differs from its default.
  const params: Record<string, string> = {}
  if (filter.q) params.q = filter.q
  if (filter.courseId) params.course = filter.courseId
  if (filter.summaryStatus) params.summary = filter.summaryStatus
  if (filter.from) params.from = filter.from
  if (filter.to) params.to = filter.to
  if (filter.archived) params.archived = 'true'
  if (filter.sort) params.sort = filter.sort
  if (filter.page && filter.page > 1) params.page = String(filter.page)
  return params
}

/** True when the search or any filter is set (the archived view, sort and page don't count). */
export function hasClassFilters(filter: ClassFilter): boolean {
  return [filter.q, filter.courseId, filter.summaryStatus, filter.from, filter.to].some(Boolean)
}
