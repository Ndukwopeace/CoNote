/**
 * Builds the demo (mock) set of services used when VITE_DATA_SOURCE=mock.
 */

// The shape the mock set must satisfy.
import type { Services } from '../types'

// The demo authentication service.
import { createMockAuthService } from './mockAuthService'
// The demo Ask CoNote AI.
import { createMockAiService } from './mockAiService'
// The demo courses, classes, notes, summaries and notifications.
import { createMockCatalog } from './mockCatalog'
// The demo profile and the demo reset.
import { createMockProfileService, resetDemoData } from './mockProfileService'
// The demo data, built relative to the current time.
import { createSeed } from './seed'

// A short delay on every demo call so loading states are visible, as they will be with a server.
const DEMO_LATENCY_MS = 300

/** Returns every mock service, wired to the browser's real storage. */
export function createMockServices(): Services {
  // Demo sign-in, stored in the browser; the profile service renames through it.
  const auth = createMockAuthService({
    // Holds only the "remember me" marker.
    localStore: window.localStorage,
    // Holds the signed-in identity for this browser session.
    sessionStore: window.sessionStorage,
    // Delay per call.
    latencyMs: DEMO_LATENCY_MS,
  })
  // One object per service area.
  return {
    // Demo sign-in.
    auth,
    // Everything else, over demo data dated from the moment the app opened (section 13).
    ...createMockCatalog({
      seed: createSeed(new Date()),
      latencyMs: DEMO_LATENCY_MS,
      // Notes, viewed summaries and read notifications survive a reload.
      store: window.localStorage,
    }),
    // Prepared answers after a short delay (FR-AI-6).
    ai: createMockAiService(),
    // The profile, kept in the browser per student.
    profile: createMockProfileService({
      auth,
      store: window.localStorage,
      latencyMs: DEMO_LATENCY_MS,
    }),
    // "Reset demo data" (FR-SET-5): delete the demo's changes, then reload onto the seed.
    demo: {
      resetDemoData: () => {
        resetDemoData(window.localStorage)
        // The demo services hold their data in memory, so a reload is what brings the seed back.
        window.location.reload()
      },
    },
  }
}
