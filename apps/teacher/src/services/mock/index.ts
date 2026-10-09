/**
 * The demo services (VITE_DATA_SOURCE=mock): the teacher app on seeded demo data (D74).
 */

// Service types.
import type { Services } from '../types'

// The demo platform's records.
import { createPlatformSeed } from './seed/platformSeed'
// The demo services.
import { createMockAuthService, readStoredSession } from './mockAuthService'
import { createMockReviewService } from './mockReviewService'
import { createMockTeachingService } from './mockTeachingService'
// Saving and restoring the platform's changes.
import { loadPlatform, savePlatform } from './platformStore'

/** The real clock. */
const now = () => new Date()

/** How long each demo call pretends to take, so loading states show. */
const DEMO_LATENCY_MS = 300

/** Builds every demo service for the running app. */
export function createMockServices(): Services {
  // One demo platform for the whole session, built around the moment the app opened, with any
  // changes saved earlier (edited and published summaries) restored over it.
  const data = loadPlatform(window.localStorage, createPlatformSeed(now()))
  // The signed-in teacher, read from the stored session.
  const actorId = () => readStoredSession(window.sessionStorage)?.user.id ?? null
  // An account's status on the demo platform, for the sign-in check.
  const accountStatus = (email: string) => data.users.find((user) => user.email === email)?.status
  return {
    // Sessions live in session storage: closing the tab signs the teacher out.
    auth: createMockAuthService({
      store: window.sessionStorage,
      // Changed passwords and reset links outlive the tab, like server data would.
      demoStore: window.localStorage,
      latencyMs: DEMO_LATENCY_MS,
      accountStatus,
    }),
    // The signed-in teacher's courses.
    teaching: createMockTeachingService({ data, actorId, latencyMs: DEMO_LATENCY_MS }),
    // Reviewing and publishing, as the signed-in teacher, saved after every change.
    review: createMockReviewService({
      data,
      actorId,
      now,
      latencyMs: DEMO_LATENCY_MS,
      onChange: () => {
        savePlatform(window.localStorage, data)
      },
    }),
  }
}
