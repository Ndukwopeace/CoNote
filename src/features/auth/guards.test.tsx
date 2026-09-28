import { act, screen } from '@testing-library/react'
import { useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import { makeSession } from '@/test/factories'
import { renderWithRouter } from '@/test/renderWithRouter'

import { RedirectIfSignedIn } from './RedirectIfSignedIn'
import { RequireStudent } from './RequireStudent'
import { useAuth } from './useAuth'

function LocationProbe({ label }: { label: string }) {
  const location = useLocation()
  return (
    <p>
      {label} at {location.pathname}
      {location.search}
    </p>
  )
}

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
  it('sends a signed-out visitor to sign in, remembering where they were going', async () => {
    renderWithRouter({ routes, path: '/notes?tab=summaries' })

    expect(
      await screen.findByText('login page at /login?redirect=%2Fnotes%3Ftab%3Dsummaries'),
    ).toBeInTheDocument()
  })

  it('shows the page to a signed-in student', async () => {
    renderWithRouter({ routes, path: '/notes', session: makeSession() })

    expect(await screen.findByText('notes page at /notes')).toBeInTheDocument()
  })

  it('shows a loading state while the session is being checked', () => {
    renderWithRouter({ routes, path: '/notes', session: makeSession() })

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('turns away a teacher with a sign-out option and no portal content', async () => {
    renderWithRouter({ routes, path: '/notes', session: makeSession({ role: 'teacher' }) })

    expect(
      await screen.findByRole('heading', { name: 'This portal is for students' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByText(/notes page/)).not.toBeInTheDocument()
  })

  it('lets a turned-away teacher sign out to the landing page', async () => {
    const { user } = renderWithRouter({
      routes: [...routes, { path: '/', element: <LocationProbe label="landing" /> }],
      path: '/notes',
      session: makeSession({ role: 'teacher' }),
    })

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByText('landing at /')).toBeInTheDocument()
  })
})

describe('RedirectIfSignedIn', () => {
  it('shows the page to a signed-out visitor', async () => {
    renderWithRouter({ routes, path: '/login' })

    expect(await screen.findByText('login page at /login')).toBeInTheDocument()
  })

  it('sends a signed-in student to the dashboard', async () => {
    renderWithRouter({ routes, path: '/login', session: makeSession() })

    expect(await screen.findByText('dashboard at /dashboard')).toBeInTheDocument()
  })
})

describe('RedirectIfSignedIn with a redirect parameter', () => {
  const redirectRoutes = [
    {
      element: <RedirectIfSignedIn />,
      children: [{ path: '/login', element: <LocationProbe label="login page" /> }],
    },
    { path: '/notes', element: <LocationProbe label="notes page" /> },
    { path: '/dashboard', element: <LocationProbe label="dashboard" /> },
  ]

  it('sends a signed-in student to the page they asked for', async () => {
    renderWithRouter({
      routes: redirectRoutes,
      path: '/login?redirect=%2Fnotes',
      session: makeSession(),
    })

    expect(await screen.findByText('notes page at /notes')).toBeInTheDocument()
  })

  it('ignores an unsafe redirect and goes to the dashboard', async () => {
    renderWithRouter({
      routes: redirectRoutes,
      path: '/login?redirect=%2F%2Fevil.com',
      session: makeSession(),
    })

    expect(await screen.findByText('dashboard at /dashboard')).toBeInTheDocument()
  })
})

describe('signing out from inside the portal', () => {
  function SignOutButton() {
    const { signOut } = useAuth()
    return (
      <button type="button" onClick={() => void signOut()}>
        sign out now
      </button>
    )
  }

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

  it('lands on the landing page, not on sign in', async () => {
    const { user } = renderWithRouter({
      routes: signOutRoutes,
      path: '/notes',
      session: makeSession(),
    })

    await user.click(await screen.findByRole('button', { name: 'sign out now' }))

    expect(await screen.findByText('landing at /')).toBeInTheDocument()
  })

  it('sends a later visit to a portal page to sign in, as usual', async () => {
    const { user, router } = renderWithRouter({
      routes: signOutRoutes,
      path: '/notes',
      session: makeSession(),
    })
    await user.click(await screen.findByRole('button', { name: 'sign out now' }))
    await screen.findByText('landing at /')

    await act(() => router.navigate('/courses'))

    expect(await screen.findByText('login page at /login?redirect=%2Fcourses')).toBeInTheDocument()
  })
})
