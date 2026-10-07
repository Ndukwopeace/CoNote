/**
 * Tests for the two route guards and the sign-out destination.
 */

// act flushes React updates; screen queries the page.
import { act, screen } from '@testing-library/react'
// Reads the current address inside the probe.
import { useLocation } from 'react-router'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

// The guards under test.
import { RedirectIfSignedIn } from './RedirectIfSignedIn'
import { RequireStudent } from './RequireStudent'
// For the sign-out button in the last group.
import { useAuth } from './useAuth'

/** Shows which page rendered and the full address, so tests can assert where they ended up. */
function LocationProbe({ label }: Readonly<{ label: string }>) {
  // The current address.
  const location = useLocation()
  return (
    // e.g. "login page at /login?redirect=%2Fnotes"
    <p>
      {label} at {location.pathname}
      {location.search}
    </p>
  )
}

// A small app: /notes is protected, /login is public, /dashboard is the default destination.
const routes = [
  {
    element: <RequireStudent />,
    children: [{ path: '/notes', element: <LocationProbe label="notes page" /> }],
  },
  {
    element: <RedirectIfSignedIn />,
    children: [{ path: '/login', element: <LocationProbe label="login page" /> }],
  },
  { path: '/dashboard', element: <LocationProbe label="dashboard" /> },
]

describe('RequireStudent', () => {
  // Proves signed-out visitors are sent to sign in, and that sign-in will bring them back.
  it('sends a signed-out visitor to sign in, remembering where they were going', async () => {
    // Act: visit a protected page with a query string.
    renderWithRouter({ routes, path: '/notes?tab=summaries' })

    // Assert: on sign-in, with the whole original address encoded in ?redirect=.
    expect(
      await screen.findByText('login page at /login?redirect=%2Fnotes%3Ftab%3Dsummaries'),
    ).toBeInTheDocument()
  })

  // Proves students get through.
  it('shows the page to a signed-in student', async () => {
    renderWithRouter({ routes, path: '/notes', session: makeSession() })

    expect(await screen.findByText('notes page at /notes')).toBeInTheDocument()
  })

  // Proves no portal content flashes while the session is still being checked.
  it('shows a loading state while the session is being checked', () => {
    // Act: render, then look immediately (synchronously), before the session check finishes.
    renderWithRouter({ routes, path: '/notes', session: makeSession() })

    // Assert: the spinner, not the page.
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  // SECURITY: proves a teacher sees the notice and none of the portal.
  it('turns away a teacher with a sign-out option and no portal content', async () => {
    // Act: a teacher visits a portal page.
    renderWithRouter({ routes, path: '/notes', session: makeSession({ role: 'teacher' }) })

    // Assert: the notice...
    expect(
      await screen.findByRole('heading', { name: 'This portal is for students' }),
    ).toBeInTheDocument()
    // ...with a way out...
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    // ...and no portal content.
    expect(screen.queryByText(/notes page/)).not.toBeInTheDocument()
  })

  // Proves the teacher's sign-out goes to the landing page.
  it('lets a turned-away teacher sign out to the landing page', async () => {
    // Arrange: add a landing route, then visit as a teacher.
    const { user } = renderWithRouter({
      routes: [...routes, { path: '/', element: <LocationProbe label="landing" /> }],
      path: '/notes',
      session: makeSession({ role: 'teacher' }),
    })

    // Act.
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    // Assert.
    expect(await screen.findByText('landing at /')).toBeInTheDocument()
  })
})

describe('RedirectIfSignedIn', () => {
  // Proves public pages work for visitors.
  it('shows the page to a signed-out visitor', async () => {
    renderWithRouter({ routes, path: '/login' })

    expect(await screen.findByText('login page at /login')).toBeInTheDocument()
  })

  // SECURITY: proves teachers and admins never see student-facing public pages (Copilot finding).
  it.each(['teacher', 'admin'] as const)(
    'shows a signed-in %s the students-only notice instead of the page',
    async (role) => {
      // Act: a non-student opens the sign-in page.
      renderWithRouter({ routes, path: '/login', session: makeSession({ role }) })

      // Assert: the notice, not the page.
      expect(
        await screen.findByRole('heading', { name: 'This portal is for students' }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/login page/)).not.toBeInTheDocument()
    },
  )

  // Proves a signed-in student skips sign-in.
  it('sends a signed-in student to the dashboard', async () => {
    renderWithRouter({ routes, path: '/login', session: makeSession() })

    expect(await screen.findByText('dashboard at /dashboard')).toBeInTheDocument()
  })
})

describe('RedirectIfSignedIn with a redirect parameter', () => {
  // Sign-in plus two destinations.
  const redirectRoutes = [
    {
      element: <RedirectIfSignedIn />,
      children: [{ path: '/login', element: <LocationProbe label="login page" /> }],
    },
    { path: '/notes', element: <LocationProbe label="notes page" /> },
    { path: '/dashboard', element: <LocationProbe label="dashboard" /> },
  ]

  // Proves a safe ?redirect= is followed after sign-in.
  it('sends a signed-in student to the page they asked for', async () => {
    renderWithRouter({
      routes: redirectRoutes,
      path: '/login?redirect=%2Fnotes',
      session: makeSession(),
    })

    expect(await screen.findByText('notes page at /notes')).toBeInTheDocument()
  })

  // SECURITY: proves an open-redirect attempt is ignored.
  it('ignores an unsafe redirect and goes to the dashboard', async () => {
    // Act: ?redirect=//evil.com
    renderWithRouter({
      routes: redirectRoutes,
      path: '/login?redirect=%2F%2Fevil.com',
      session: makeSession(),
    })

    // Assert: dashboard, not the outside site.
    expect(await screen.findByText('dashboard at /dashboard')).toBeInTheDocument()
  })
})

describe('signing out from inside the portal', () => {
  /** A portal page with just a sign-out button. */
  function SignOutButton() {
    // Sign-out action.
    const { signOut } = useAuth()
    return (
      <button type="button" onClick={() => void signOut()}>
        sign out now
      </button>
    )
  }

  // Two portal pages and two public pages.
  const signOutRoutes = [
    {
      element: <RequireStudent />,
      children: [
        { path: '/notes', element: <SignOutButton /> },
        { path: '/courses', element: <LocationProbe label="courses page" /> },
      ],
    },
    {
      element: <RedirectIfSignedIn />,
      children: [
        { path: '/', element: <LocationProbe label="landing" /> },
        { path: '/login', element: <LocationProbe label="login page" /> },
      ],
    },
  ]

  // Proves the sign-out race found in M1 (decision D21) stays fixed.
  it('lands on the landing page, not on sign in', async () => {
    // Arrange: signed in on a portal page.
    const { user } = renderWithRouter({
      routes: signOutRoutes,
      path: '/notes',
      session: makeSession(),
    })

    // Act.
    await user.click(await screen.findByRole('button', { name: 'sign out now' }))

    // Assert.
    expect(await screen.findByText('landing at /')).toBeInTheDocument()
  })

  // Proves the landing-page destination is used once, then normal behaviour returns (flow F10).
  it('sends a later visit to a portal page to sign in, as usual', async () => {
    // Arrange: sign out and land on the landing page.
    const { user, router } = renderWithRouter({
      routes: signOutRoutes,
      path: '/notes',
      session: makeSession(),
    })
    await user.click(await screen.findByRole('button', { name: 'sign out now' }))
    await screen.findByText('landing at /')

    // Act: try another portal page.
    await act(() => router.navigate('/courses'))

    // Assert: sent to sign in with a redirect back.
    expect(await screen.findByText('login page at /login?redirect=%2Fcourses')).toBeInTheDocument()
  })
})
