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
import { createMockAuthService } from './mockAuthService'
import { createMockHealthService } from './mockHealthService'

/** How long each demo call pretends to take, so loading states show. */
const DEMO_LATENCY_MS = 300

/** The real clock. */
const now = () => new Date()

/** Builds every demo service for the running app. */
export function createMockServices(): Services {
  // One demo platform for the whole session, built around the moment the app opened.
  const data = createPlatformSeed(now())
  return {
    // Sessions live in session storage: closing the tab signs the administrator out.
    auth: createMockAuthService({
      store: window.sessionStorage,
      // Changed passwords and reset links outlive the tab, like server data would.
      demoStore: window.localStorage,
      latencyMs: DEMO_LATENCY_MS,
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
  }
}
