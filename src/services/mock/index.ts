import type { Services } from '../types'

import { createMockAuthService } from './mockAuthService'

const DEMO_LATENCY_MS = 300

export function createMockServices(): Services {
  return {
    auth: createMockAuthService({
      localStore: window.localStorage,
      sessionStore: window.sessionStorage,
      latencyMs: DEMO_LATENCY_MS,
    }),
  }
}
