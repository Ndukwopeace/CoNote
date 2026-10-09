/**
 * The demo services (VITE_DATA_SOURCE=mock): the admin app on seeded demo data (D66, D69).
 */

// Service types.
import type { Services } from '../types'

// The demo platform's records.
import { createPlatformSeed } from './seed/platformSeed'
// The demo services.
import { createMockAlertService } from './mockAlertService'
import { createMockAnalyticsService } from './mockAnalyticsService'
import { createMockAuthService, readStoredSession } from './mockAuthService'
import { createMockCourseService } from './mockCourseService'
import { createMockHealthService } from './mockHealthService'
import { createMockUserService } from './mockUserService'
// Saving and restoring the platform's changes.
import { loadPlatform, savePlatform } from './platformStore'

/** How long each demo call pretends to take, so loading states show. */
const DEMO_LATENCY_MS = 300

/** The real clock. */
const now = () => new Date()

/** Builds every demo service for the running app. */
export function createMockServices(): Services {
  // One demo platform for the whole session, built around the moment the app opened, with any
  // changes saved earlier (invitations, status changes) restored over it.
  const data = loadPlatform(window.localStorage, createPlatformSeed(now()))
  // An account's status on the demo platform, for the sign-in check.
  const accountStatus = (email: string) => data.users.find((user) => user.email === email)?.status
  return {
    // Sessions live in session storage: closing the tab signs the administrator out.
    auth: createMockAuthService({
      store: window.sessionStorage,
      // Changed passwords and reset links outlive the tab, like server data would.
      demoStore: window.localStorage,
      latencyMs: DEMO_LATENCY_MS,
      accountStatus,
    }),
    // Counts and activity from the demo platform.
    analytics: createMockAnalyticsService({ data, now, latencyMs: DEMO_LATENCY_MS }),
    // Alerts computed from the demo platform.
    alerts: createMockAlertService({ data, now, latencyMs: DEMO_LATENCY_MS }),
    // All operational, unless the demo override in local storage says otherwise.
    health: createMockHealthService({
      demoStore: window.localStorage,
      now,
      latencyMs: DEMO_LATENCY_MS,
    }),
    // Courses and enrolment, changed as the signed-in administrator and saved after every change.
    courses: createMockCourseService({
      data,
      now,
      actorId: () => readStoredSession(window.sessionStorage)?.user.id ?? null,
      latencyMs: DEMO_LATENCY_MS,
      onChange: () => {
        savePlatform(window.localStorage, data)
      },
    }),
    // Accounts, changed as the signed-in administrator and saved after every change.
    users: createMockUserService({
      data,
      now,
      actorId: () => readStoredSession(window.sessionStorage)?.user.id ?? null,
      latencyMs: DEMO_LATENCY_MS,
      onChange: () => {
        savePlatform(window.localStorage, data)
      },
    }),
  }
}
