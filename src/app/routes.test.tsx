import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeSession } from '@/test/factories'
import { renderWithRouter } from '@/test/renderWithRouter'

import { routes } from './routes'

function renderApp(path: string, signedIn = true) {
  return renderWithRouter({ routes, path, ...(signedIn ? { session: makeSession() } : {}) })
}

describe('app routes: portal pages', () => {
  it.each([
    ['/dashboard', 'Dashboard'],
    ['/classes', 'All classes'],
    ['/courses', 'My Courses'],
    ['/courses/swe-311', 'Course details'],
    ['/courses/swe-311/classes/c2', 'Class'],
    ['/courses/swe-311/classes/c2/summary', 'Class summary'],
    ['/notes', 'Notes'],
    ['/notes/new', 'New note'],
    ['/notes/n1', 'Note'],
    ['/notes/n1/edit', 'Edit note'],
    ['/ask-ai', 'Ask CoNote AI'],
    ['/notifications', 'Notifications'],
    ['/settings/profile', 'Settings'],
  ])('renders %s for a signed-in student', async (path, heading) => {
    renderApp(path)

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('greets the student by first name on the dashboard', async () => {
    renderApp('/dashboard')

    expect(await screen.findByText(/Welcome, Victory/)).toBeInTheDocument()
  })

  it('redirects /profile to the profile tab of settings', async () => {
    const { router } = renderApp('/profile')

    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(router.state.location.pathname).toBe('/settings/profile')
  })

  it('redirects /settings to the profile tab', async () => {
    const { router } = renderApp('/settings')

    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(router.state.location.pathname).toBe('/settings/profile')
  })

  it('redirects an unknown settings tab to the profile tab', async () => {
    const { router } = renderApp('/settings/billing')

    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(router.state.location.pathname).toBe('/settings/profile')
  })
})

describe('app routes: public pages', () => {
  it('shows the landing page to a signed-out visitor', async () => {
    renderApp('/', false)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Your notes\. Collective understanding\./,
      }),
    ).toBeInTheDocument()
  })

  it('sends a signed-in student from the landing page to the dashboard', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  it.each([
    ['/signup', 'Create your account'],
    ['/forgot-password', 'Reset your password'],
    ['/reset-password', 'Choose a new password'],
    ['/terms', 'Terms of Service'],
    ['/privacy', 'Privacy Policy'],
  ])('renders %s', async (path, heading) => {
    renderApp(path, false)

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('shows a not-found page with a way back for unknown paths', async () => {
    renderApp('/no-such-page', false)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })
})

describe('app routes: signing in', () => {
  it('sends a signed-out visitor from a portal page to sign in', async () => {
    const { router } = renderApp('/courses', false)

    await screen.findByRole('heading', { level: 1, name: 'Welcome back' })
    expect(router.state.location.search).toBe('?redirect=%2Fcourses')
  })

  it('returns the student to the page they asked for after signing in', async () => {
    const { user } = renderApp('/notes', false)
    await screen.findByRole('heading', { level: 1, name: 'Welcome back' })

    await user.type(screen.getByLabelText('Email address'), 'victory@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()
  })

  it('goes to the dashboard after signing in without a redirect', async () => {
    const { user } = renderApp('/login', false)
    await screen.findByRole('heading', { level: 1, name: 'Welcome back' })

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  it('shows the error when sign-in fails', async () => {
    const { user } = renderApp('/login', false)
    await screen.findByRole('heading', { level: 1, name: 'Welcome back' })

    await user.type(screen.getByLabelText('Email address'), 'victory@example.com')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your password.')
  })
})
