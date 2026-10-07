/**
 * The standard way to render a page or component in tests: real providers, a memory router and
 * injected demo services with no delay.
 */

// The query cache class.
import { QueryClient } from '@tanstack/react-query'
// Renders React into the fake DOM.
import { render } from '@testing-library/react'
// Simulates real user input (typing, clicking) with the right event order.
import userEvent from '@testing-library/user-event'
// A router that keeps its history in memory instead of the address bar.
import { createMemoryRouter, type InitialEntry, type RouteObject } from 'react-router'
// Connects the router to React.
import { RouterProvider } from 'react-router/dom'

// The same providers the real app uses.
import { AppProviders } from '@/app/AppProviders'
// Storage key builder, to pre-seed a session.
import { storageKey } from '@/lib/storage'
// The demo auth service, used here as the test fake.
import { createMockAuthService } from '@/services/mock/mockAuthService'
// The demo AI, used as the test fake with no delay.
import { createMockAiService } from '@/services/mock/mockAiService'
// The demo profile service, used as the test fake.
import { createMockProfileService } from '@/services/mock/mockProfileService'
// The demo catalog services and their data, used as the test fakes.
import { createMockCatalog } from '@/services/mock/mockCatalog'
import { createSeed } from '@/services/mock/seed'
// Services type.
import type { Services } from '@/services/types'
// Session type.
import type { Session } from '@/types/auth'

/** What a test can pass in. */
interface RenderOptions {
  // The routes to mount.
  routes: RouteObject[]
  // The starting address, or an address plus navigation state.
  path: InitialEntry
  /** Signs this user in before the first render. */
  session?: Session
  // Replace particular services, e.g. one that fails on purpose.
  services?: Partial<Services>
}

/** Demo services with zero delay, plus any overrides. */
export function createTestServices(overrides: Partial<Services> = {}): Services {
  // The demo auth service, instant; the profile service renames through it.
  const auth = createMockAuthService({
    localStore: window.localStorage,
    sessionStore: window.sessionStorage,
    latencyMs: 0,
  })
  return {
    // Demo sign-in.
    auth,
    // The profile, instant.
    profile: createMockProfileService({ auth, store: window.localStorage, latencyMs: 0 }),
    // Courses, classes, notes, summaries and notifications over fresh demo data, instant.
    ...createMockCatalog({ seed: createSeed(new Date()), latencyMs: 0 }),
    // The demo AI, answering at once.
    ai: createMockAiService({ delay: () => 0 }),
    // The test's replacements win.
    ...overrides,
  }
}

/** A query cache that fails immediately instead of retrying, so error tests stay fast. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

/** Renders `routes` at `path` inside the real app providers, with fake services injected. */
export function renderWithRouter({ routes, path, session, services }: RenderOptions) {
  // Pre-seed a session where the demo service looks for it, so the test starts signed in.
  if (session) window.sessionStorage.setItem(storageKey('session'), JSON.stringify(session))

  // Services for this test.
  const testServices = createTestServices(services)
  // A fresh cache, so tests never share data.
  const queryClient = createTestQueryClient()
  // Router starting at the given address.
  const router = createMemoryRouter(routes, { initialEntries: [path] })

  // Render with the real providers.
  const result = render(
    <AppProviders services={testServices} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  // Return the render result plus the tools tests need.
  return { ...result, user: userEvent.setup(), router, queryClient, services: testServices }
}
