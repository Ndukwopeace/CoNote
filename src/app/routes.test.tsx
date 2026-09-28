/**
 * Tests for the full route table: every page renders, redirects work, and sign-in returns the
 * student to where they were going. These use the real routes, guards and layouts.
 */

// Queries the rendered page.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, describe, expect, it } from 'vitest'

// Fakes the installed app's display mode.
import { resetDisplayMode, setStandalone } from '@/test/displayMode'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

// The real route table under test.
import { routes } from './routes'

/** Renders the whole app at `path`, signed in unless told otherwise. */
function renderApp(path: string, signedIn = true) {
  // Only pass a session when signed in.
  return renderWithRouter({ routes, path, ...(signedIn ? { session: makeSession() } : {}) })
}

describe('app routes: portal pages', () => {
  // Proves every portal address reaches its page, identified by its one h1.
  it.each([
    // [address, expected h1]
    ['/dashboard', /^Good (morning|afternoon|evening), Victory$/],
    ['/classes', 'All classes'],
    ['/courses', 'My Courses'],
    ['/courses/swe-311', 'Software Engineering'],
    ['/courses/swe-311/classes/swe-311-c2', 'Software Requirements'],
    ['/courses/swe-311/classes/swe-311-c2/summary', 'Class summary'],
    ['/notes', 'Notes'],
    ['/notes/new', 'New note'],
    ['/notes/note-1', 'Why process matters'],
    ['/notes/note-1/edit', 'Edit note'],
    ['/ask-ai', 'Ask CoNote AI'],
    ['/notifications', 'Notifications'],
    ['/settings/profile', 'Settings'],
    // One test per row.
  ])('renders %s for a signed-in student', async (path, heading) => {
    // Act: render the address.
    renderApp(path)

    // Assert: the expected page heading.
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  // Proves the session reaches the pages.
  it('greets the student by first name on the dashboard', async () => {
    // Act: render the dashboard.
    renderApp('/dashboard')

    // Assert: greeting by first name.
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Good (morning|afternoon|evening), Victory/,
      }),
    ).toBeInTheDocument()
  })

  // Proves the old /profile address still works (decision D7).
  it('redirects /profile to the profile tab of settings', async () => {
    // Act: render, keeping the router to inspect the final address.
    const { router } = renderApp('/profile')

    // Wait for the redirect to finish.
    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    // Assert: the address was rewritten.
    expect(router.state.location.pathname).toBe('/settings/profile')
  })

  // Proves /settings opens the default tab.
  it('redirects /settings to the profile tab', async () => {
    // Act: render, keeping the router to inspect the final address.
    const { router } = renderApp('/settings')

    // Wait for the redirect to finish.
    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    // Assert: the address was rewritten.
    expect(router.state.location.pathname).toBe('/settings/profile')
  })

  // SECURITY: proves a made-up tab in the address is replaced, not shown.
  it('redirects an unknown settings tab to the profile tab', async () => {
    // Act: render, keeping the router to inspect the final address.
    const { router } = renderApp('/settings/billing')

    // Wait for the redirect to finish.
    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    // Assert: the address was rewritten.
    expect(router.state.location.pathname).toBe('/settings/profile')
  })
})

describe('app routes: public pages', () => {
  // Proves visitors see the landing page.
  it('shows the landing page to a signed-out visitor', async () => {
    // Act: visitor opens the landing page.
    renderApp('/', false)

    // Assert: the landing page's tagline heading.
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Your notes\. Collective understanding\./,
      }),
    ).toBeInTheDocument()
  })

  // Proves signed-in students skip the landing page.
  it('sends a signed-in student from the landing page to the dashboard', async () => {
    // Act: signed-in student opens the landing page.
    renderApp('/')

    // Assert: on the dashboard.
    expect(
      await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), / }),
    ).toBeInTheDocument()
  })

  it.each([
    // Proves every other public page renders: [address, expected h1].
    ['/signup', 'Create your account'],
    ['/forgot-password', 'Reset your password'],
    // Without a code from a reset email, the reset page shows its expired state (FR-AUTH-5).
    ['/reset-password', 'This reset link has expired'],
    ['/terms', 'Terms of Service'],
    ['/privacy', 'Privacy Policy'],
  ])('renders %s', async (path, heading) => {
    // Act: visitor opens the page.
    renderApp(path, false)

    // Assert: the expected page heading.
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  // Proves unknown addresses get the 404 page with a way back.
  it('shows a not-found page with a way back for unknown paths', async () => {
    // Act: visitor opens a made-up address.
    renderApp('/no-such-page', false)

    // Assert: the not-found heading.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    // Assert: the way back points at the dashboard.
    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })
})

describe('app routes: signing in', () => {
  // SECURITY: proves portal pages are closed to signed-out visitors, with a redirect back.
  it('sends a signed-out visitor from a portal page to sign in', async () => {
    // Act: render, keeping the router to inspect the final address.
    const { router } = renderApp('/courses', false)

    // Wait for the sign-in page.
    await screen.findByRole('heading', { level: 1, name: 'Welcome back' })
    // Assert: the original address is kept for after sign-in.
    expect(router.state.location.search).toBe('?redirect=%2Fcourses')
  })

  // Proves the full deep-link flow: visit, sign in, arrive where you meant to go (flow F2).
  it('returns the student to the page they asked for after signing in', async () => {
    // Arrange: render signed out, keeping the simulated user.
    const { user } = renderApp('/notes', false)
    // Wait for the sign-in page.
    await screen.findByRole('heading', { level: 1, name: 'Welcome back' })

    // Act: fill in the email...
    await user.type(screen.getByLabelText('Email address'), 'victory@example.com')
    // ...and password...
    await user.type(screen.getByLabelText('Password'), 'password1')
    // ...and submit.
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // Assert: back on the page first requested.
    expect(await screen.findByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()
  })

  // Proves the default destination after sign-in.
  it('goes to the dashboard after signing in without a redirect', async () => {
    // Arrange: render signed out, keeping the simulated user.
    const { user } = renderApp('/login', false)
    // Wait for the sign-in page.
    await screen.findByRole('heading', { level: 1, name: 'Welcome back' })

    // Act: use the Google button.
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    // Assert: on the dashboard.
    expect(
      await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), / }),
    ).toBeInTheDocument()
  })
})

describe('app routes: the installed app (decision D36)', () => {
  // Back to a normal browser tab after each test.
  afterEach(() => {
    resetDisplayMode()
  })

  // Proves the installed app never shows the public landing page: "/" goes to sign in.
  it('sends a signed-out visitor from the landing page to sign in', async () => {
    // Arrange: running as the installed app.
    setStandalone(true)

    // Act: open "/".
    const { router } = renderApp('/', false)

    // Assert: on sign in, not the landing page.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome back' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  // Proves the browser website keeps its landing page.
  it('still shows the landing page in a browser tab', async () => {
    // Arrange: a normal browser tab.
    setStandalone(false)

    // Act.
    renderApp('/', false)

    // Assert.
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Your notes\. Collective understanding\./,
      }),
    ).toBeInTheDocument()
  })

  // Proves sign-out in the installed app ends on sign in rather than the landing page.
  it('ends on sign in after signing out', async () => {
    // Arrange: signed in, in the installed app.
    setStandalone(true)
    const { user, router } = renderApp('/dashboard')
    await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), / })

    // Act: sign out from the account menu.
    await user.click(screen.getByRole('button', { name: /Account menu/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome back' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })
})
