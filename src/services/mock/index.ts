/**
 * Builds the demo (mock) set of services used when VITE_DATA_SOURCE=mock.
 */

// The shape the mock set must satisfy.
import type { Services } from '../types'

// The demo authentication service.
import { createMockAuthService } from './mockAuthService'
// The demo courses, classes, notes, summaries and notifications.
import { createMockCatalog } from './mockCatalog'
// The demo data, built relative to the current time.
import { createSeed } from './seed'

// A short delay on every demo call so loading states are visible, as they will be with a server.
const DEMO_LATENCY_MS = 300

/** Returns every mock service, wired to the browser's real storage. */
export function createMockServices(): Services {
  // One object per service area.
  return {
    // Demo sign-in, stored in the browser.
    auth: createMockAuthService({
      // Holds only the "remember me" marker.
      localStore: window.localStorage,
      // Holds the signed-in identity for this browser session.
      sessionStore: window.sessionStorage,
      // Delay per call.
      latencyMs: DEMO_LATENCY_MS,
    }),
    // Everything else, over demo data dated from the moment the app opened (section 13).
    ...createMockCatalog({ seed: createSeed(new Date()), latencyMs: DEMO_LATENCY_MS }),
  }
}
