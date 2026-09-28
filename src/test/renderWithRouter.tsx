import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { AppProviders } from '@/app/AppProviders'
import { storageKey } from '@/lib/storage'
import { createMockAuthService } from '@/services/mock/mockAuthService'
import type { Services } from '@/services/types'
import type { Session } from '@/types/auth'

interface RenderOptions {
  routes: RouteObject[]
  path: string
  /** Signs this user in before the first render. */
  session?: Session
  services?: Partial<Services>
}

export function createTestServices(overrides: Partial<Services> = {}): Services {
  return {
    auth: createMockAuthService({
      localStore: window.localStorage,
      sessionStore: window.sessionStorage,
      latencyMs: 0,
    }),
    ...overrides,
  }
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

/** Renders `routes` at `path` inside the real app providers, with fake services injected. */
export function renderWithRouter({ routes, path, session, services }: RenderOptions) {
  if (session) window.sessionStorage.setItem(storageKey('session'), JSON.stringify(session))

  const testServices = createTestServices(services)
  const queryClient = createTestQueryClient()
  const router = createMemoryRouter(routes, { initialEntries: [path] })

  const result = render(
    <AppProviders services={testServices} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  return { ...result, user: userEvent.setup(), router, queryClient, services: testServices }
}
