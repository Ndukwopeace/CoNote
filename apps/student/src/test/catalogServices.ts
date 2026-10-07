/**
 * Catalog service variations for page tests: empty data (empty states), failing requests
 * (error states) and requests that never finish (loading states).
 */

// The app's error type.
import { AppError } from '@/lib/errors'
// The demo catalog, used as the base.
import { createMockCatalog } from '@/services/mock/mockCatalog'
// The interfaces being varied.
import type { Services } from '@/services/types'

/** The five read-only catalog services. */
type Catalog = Pick<Services, 'courses' | 'classes' | 'notes' | 'summaries' | 'notifications'>

/** A student enrolled in nothing: every list is empty. */
export function emptyCatalog(): Catalog {
  // The real mock over an empty seed, so not-found behaviour stays real.
  return createMockCatalog({
    seed: { courses: [], classes: [], notes: [], summaries: [], notifications: [] },
    latencyMs: 0,
  })
}

/** Replaces every method of every catalog service with `make()`. */
function catalogOf(make: () => Promise<never>): Catalog {
  return {
    // Course reads.
    courses: { listMyCourses: make, getCourse: make },
    // Class reads.
    classes: { listClasses: make, listMyClasses: make, getClass: make },
    // Note reads and writes.
    notes: {
      listMyNotes: make,
      getNote: make,
      createNote: make,
      updateNote: make,
      deleteNote: make,
    },
    // Summary reads.
    summaries: { listPublished: make, getByClass: make, markViewed: make },
    // Notification reads.
    notifications: { list: make, unreadCount: make, markRead: make, markAllRead: make },
  }
}

/** Every request fails as if the connection dropped. */
export function failingCatalog(): Catalog {
  // A network AppError, which pages show with "Try again".
  return catalogOf(() => Promise.reject(new AppError('network', 'offline')))
}

/** Every request hangs, so a test can see the loading skeletons. */
export function hangingCatalog(): Catalog {
  // A promise nothing ever settles.
  return catalogOf(() => new Promise<never>(() => undefined))
}
