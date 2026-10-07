/**
 * The demo services (VITE_DATA_SOURCE=mock): the admin app on seeded demo data (D66).
 */

// Service types.
import type { Services } from '../types'

// The demo sign-in.
import { createMockAuthService } from './mockAuthService'

/** How long each demo call pretends to take, so loading states show. */
const DEMO_LATENCY_MS = 300

/** Builds every demo service for the running app. */
export function createMockServices(): Services {
  return {
    // Sessions live in session storage: closing the tab signs the administrator out.
    auth: createMockAuthService({ store: window.sessionStorage, latencyMs: DEMO_LATENCY_MS }),
  }
}
