/**
 * A small portal for the package's tests: a demo auth service with its own accounts, the real
 * providers, and routes built from the shared pages, guards and frame.
 */

// Query cache.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Rendering and the icon the test navigation uses.
import { render } from '@testing-library/react'
// Realistic typing and clicking.
import userEvent from '@testing-library/user-event'
// An in-memory router, so tests choose the starting address.
import { BookOpen } from 'lucide-react'
import { createMemoryRouter, type InitialEntry, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'

// Tooltip settings, which the frame's icon rail needs.
import { TooltipProvider } from '@conote/ui/tooltip'

import { AuthProvider } from '../auth/AuthProvider'
import { RedirectIfSignedIn, RequireRole } from '../auth/guards'
import {
  createDemoAuthService,
  readStoredSession,
  type MockAuthOptions,
} from '../auth/mockAuthService'
import type { AuthService, Session, SessionUser } from '../auth/types'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { LoginPage } from '../pages/LoginPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { PortalFrame } from '../frame/PortalFrame'
import { NotFoundPage } from '../components/NotFoundPage'

/** The demo password of every test account. */
export const PASSWORD = 'password1'

/** The prefix of the test portal's own storage keys. */
export const PREFIX = 'conote-test:'

/** The test portal's session key. */
export const SESSION_KEY = `${PREFIX}session`

/** The test accounts: a member of the portal, and a student who is turned away. */
export const STAFF: SessionUser = {
  id: 'staff-1',
  role: 'teacher',
  fullName: 'Sam Staff',
  email: 'staff@conote.example',
}
export const STUDENT: SessionUser = {
  id: 'student-1',
  role: 'student',
  fullName: 'Vic Student',
  email: 'student@conote.example',
}

/** The test portal's addresses. */
export const PATHS = {
  login: '/t/login',
  forgot: '/t/forgot-password',
  reset: '/t/reset-password',
  home: '/t/home',
} as const

/** The demo service's configuration. */
export const CONFIG = {
  accounts: [STAFF, STUDENT],
  password: PASSWORD,
  sessionKey: SESSION_KEY,
  demoDataPrefix: 'conote-test-demo:',
  resetPath: PATHS.reset,
} as const

/** The wrong-role screen's wording in the test portal. */
export const NOTICE = { heading: 'This portal is for staff', pageTitle: 'Staff only' }

/** A demo auth service over the test storage, without delay. */
export function createTestAuth(options: Partial<MockAuthOptions> = {}): AuthService {
  return createDemoAuthService({
    ...CONFIG,
    store: window.sessionStorage,
    demoStore: window.localStorage,
    latencyMs: 0,
    ...options,
  })
}

/** The test portal's routes. */
export function testRoutes(): RouteObject[] {
  return [
    {
      element: <RedirectIfSignedIn allowedRole="teacher" notice={NOTICE} home={PATHS.home} />,
      children: [
        {
          path: PATHS.login,
          element: (
            <LoginPage
              title="CoNote Test"
              subtitle="Sign in to test."
              forgotPasswordPath={PATHS.forgot}
              demo={{ email: STAFF.email, password: PASSWORD }}
            />
          ),
        },
        { path: PATHS.forgot, element: <ForgotPasswordPage loginPath={PATHS.login} /> },
        {
          path: PATHS.reset,
          element: <ResetPasswordPage loginPath={PATHS.login} forgotPasswordPath={PATHS.forgot} />,
        },
      ],
    },
    {
      element: (
        <RequireRole
          allowedRole="teacher"
          notice={NOTICE}
          loginTo={(redirect) => `${PATHS.login}?redirect=${encodeURIComponent(redirect)}`}
        />
      ),
      children: [
        {
          element: (
            <PortalFrame
              name="Test"
              homePath={PATHS.home}
              items={[{ label: 'Home', to: PATHS.home, icon: BookOpen }]}
              settingsPath="/t/settings"
            />
          ),
          children: [
            { path: PATHS.home, element: <h1>Home page</h1> },
            { path: '/t/*', element: <NotFoundPage homePath={PATHS.home} homeLabel="Go home" /> },
          ],
        },
      ],
    },
  ]
}

/** What a test renders. */
interface RenderOptions {
  path: InitialEntry
  // Signs in as this user before rendering.
  session?: Session
  // Replaces the demo service, for example one that fails.
  auth?: AuthService
  // Options for the demo service, such as an account's status.
  authOptions?: Partial<MockAuthOptions>
  // Replaces the routes.
  routes?: RouteObject[]
}

/** Renders the test portal at `path`, signed in as `session` when given. */
export function renderPortal({ path, session, auth, authOptions, routes }: RenderOptions) {
  // Sign in by storing the session where the demo service looks.
  if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  const service = auth ?? createTestAuth(authOptions)
  // A cache that never retries, so failures show at once.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(routes ?? testRoutes(), { initialEntries: [path] })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider auth={service} storagePrefix={PREFIX}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
  return { ...result, user: userEvent.setup(), router, queryClient, auth: service }
}

/** The session stored for the test portal, if any. */
export function storedSession() {
  return readStoredSession(window.sessionStorage, SESSION_KEY)
}
