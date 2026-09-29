/**
 * Which cached data is kept on the device for offline reading (FR-PWA-8).
 */

/** Query areas kept offline: the notes, and the courses and classes that label them. */
const OFFLINE_ROOTS: ReadonlySet<unknown> = new Set(['notes', 'courses', 'classes'])

/** How long kept data stays usable: 7 days, the same as drafts. */
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** The part of a query the rule reads. */
interface QueryLike {
  // e.g. ['notes', 'detail', 'note-1'].
  queryKey: readonly unknown[]
  // Only loaded data is worth keeping.
  state: { status: string }
}

/**
 * True for data worth reading offline: loaded successfully, and in one of the kept areas.
 * Everything else (notifications, summaries until M5) is left out, so less is stored.
 */
export function shouldKeepOffline(query: QueryLike): boolean {
  return query.state.status === 'success' && OFFLINE_ROOTS.has(query.queryKey[0])
}
