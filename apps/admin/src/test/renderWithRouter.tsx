/**
 * Renders admin routes inside the real providers, with demo services and an optional signed-in
 * session, for page and guard tests.
 */

// Query cache.
import { QueryClient } from '@tanstack/react-query'
// Rendering.
import { render } from '@testing-library/react'
// Realistic typing and clicking.
import userEvent from '@testing-library/user-event'
// An in-memory router, so tests choose the starting address.
import { createMemoryRouter, type InitialEntry, type RouteObject } from 'react-router'
// Router provider for the DOM.
import { RouterProvider } from 'react-router/dom'

// The app's providers.
import { AppProviders } from '@/app/AppProviders'
// The demo services, with no simulated delay.
import { createMockAlertService } from '@/services/mock/mockAlertService'
import { createMockAnalyticsService } from '@/services/mock/mockAnalyticsService'
import {
  createMockAuthService,
  readStoredSession,
  SESSION_KEY,
} from '@/services/mock/mockAuthService'
import { createMockHealthService } from '@/services/mock/mockHealthService'
import { createMockUserService } from '@/services/mock/mockUserService'
// The records the demo services read.
import { emptyPlatformData, type PlatformData } from '@/services/platformData'
// Service types.
import type { Services } from '@/services/types'
// Session shape.
import type { Session } from '@/types/auth'

/** What a test renders. */
interface RenderOptions {
  routes: RouteObject[]
  path: InitialEntry
  session?: Session
  // The platform records the services read; empty unless the test needs some.
  platform?: PlatformData
  // Replaces individual services, for example one that fails.
  overrides?: Partial<Services>
}

/** Demo services over `platform` and test storage, without delays, on the real clock. */
export function createTestServices(platform: PlatformData = emptyPlatformData()): Services {
  // The real clock; tests that need a fixed time use vi.setSystemTime.
  const now = () => new Date()
  return {
    auth: createMockAuthService({
      store: window.sessionStorage,
      demoStore: window.localStorage,
      latencyMs: 0,
      // Sign-in checks the account's status on the test platform, as the app does.
      accountStatus: (email) => platform.users.find((user) => user.email === email)?.status,
    }),
    analytics: createMockAnalyticsService({ data: platform, now, latencyMs: 0 }),
    alerts: createMockAlertService({ data: platform, now, latencyMs: 0 }),
    health: createMockHealthService({ demoStore: window.localStorage, now, latencyMs: 0 }),
    users: createMockUserService({
      data: platform,
      now,
      actorId: () => readStoredSession(window.sessionStorage)?.user.id ?? null,
      latencyMs: 0,
    }),
  }
}

/** A query cache that never retries, so failures show at once. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

/** Renders `routes` at `path`, signed in as `session` when given. */
export function renderWithRouter({ routes, path, session, platform, overrides }: RenderOptions) {
  // Sign in by storing the session where the demo service looks.
  if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  // Fresh services, cache and router for each test.
  const services = { ...createTestServices(platform), ...overrides }
  const queryClient = createTestQueryClient()
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  // Render with the real providers.
  const result = render(
    <AppProviders services={services} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  // Hand back what tests inspect.
  return { ...result, user: userEvent.setup(), router, queryClient, services }
}
