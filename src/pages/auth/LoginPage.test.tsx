/**
 * Tests for the sign-in page (FR-AUTH-1, FR-AUTH-3, FR-AUTH-6), rendered inside the real routes.
 */

// Queries the rendered page.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table, so guards and layouts take part.
import { routes } from '@/app/routes'
// The notice the reset page sends.
import { authNoticeState } from '@/lib/authNotice'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Auth services that hang or fail.
import { hangingAuth, offlineAuth } from '@/test/authServices'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// Services type.
import type { Services } from '@/services/types'
// Navigation entry type.
import type { InitialEntry } from 'react-router'

/** Renders the sign-in page and waits for it to load. */
async function renderLogin(path: InitialEntry = '/login', services?: Partial<Services>) {
  // Render signed out.
  const result = renderWithRouter({ routes, path, ...(services ? { services } : {}) })
  // Pages are lazy-loaded; wait for the heading.
  await screen.findByRole('heading', { level: 1, name: 'Welcome back' })
  // Hand back the tools.
  return result
}

describe('LoginPage', () => {
  // Proves every part of FR-AUTH-1 is present and accessible.
  it('shows the sign-in form with every option and no accessibility problems', async () => {
    // Act.
    const { container } = await renderLogin()

    // Assert: fields, options and links.
    expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByLabelText('Remember me')).not.toBeChecked()
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    // Google is the only provider (decision D38), and its button says what it does.
    const google = screen.getByRole('button', { name: 'Continue with Google' })
    expect(google).toHaveTextContent('Continue with Google')
    expect(screen.queryByRole('button', { name: /Microsoft/ })).toBeNull()
    // The official four-colour Google "G", decorative because the text names the button.
    const logo = google.querySelector('svg')
    expect(logo).toHaveAttribute('aria-hidden', 'true')
    const colours = Array.from(logo?.querySelectorAll('path') ?? [], (path) =>
      path.getAttribute('fill'),
    )
    expect(colours.sort()).toEqual(['#34A853', '#4285F4', '#EA4335', '#FBBC05'])
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup')
    // Assert: accessible.
    await expectNoAxeViolations(container)
  })

  // Proves empty fields are caught inline on submit, before anything is sent (FR-AUTH-3).
  it('shows inline errors for empty fields on submit', async () => {
    // Arrange.
    const { user } = await renderLogin()

    // Act: submit an empty form.
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // Assert: each field names its own problem.
    expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription(
      'Enter your email address.',
    )
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.')
    // Assert: focus moved to the first problem, so keyboard users land on it.
    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  // Proves errors appear when leaving a field, not only on submit (FR-AUTH-3).
  it('checks the email when the student leaves the field', async () => {
    // Arrange.
    const { user } = await renderLogin()

    // Act: type a bad address and tab away.
    await user.type(screen.getByLabelText('Email address'), 'victory@')
    await user.tab()

    // Assert.
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
  })

  // Proves the button shows progress and can't be pressed twice (FR-AUTH-6).
  it('disables the form while signing in', async () => {
    // Arrange: a service that never answers.
    const { user } = await renderLogin('/login', { auth: hangingAuth() })

    // Act: fill in and submit.
    await user.type(screen.getByLabelText('Email address'), 'victory@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // Assert: the button says what's happening and is disabled, and so are the providers.
    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()
  })

  // Proves a server failure shows in an alert above the form (FR-AUTH-6).
  it('shows a server error in an alert', async () => {
    // Arrange: a service that always fails.
    const { user } = await renderLogin('/login', { auth: offlineAuth() })

    // Act.
    await user.type(screen.getByLabelText('Email address'), 'victory@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // Assert: the network wording, announced, and the form usable again.
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't reach CoNote")
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  // Proves the success notice from a password reset is shown (FR-AUTH-5).
  it('shows the password-updated notice sent by the reset page', async () => {
    // Act: arrive with the notice in navigation state.
    await renderLogin({ pathname: '/login', state: authNoticeState('passwordUpdated') })

    // Assert: announced politely.
    expect(screen.getByRole('status')).toHaveTextContent('Your password has been updated.')
  })

  // Proves "remember me" reaches the service (the service tests cover what it stores).
  it('signs in with "remember me" and goes to the dashboard', async () => {
    // Arrange.
    const { user } = await renderLogin()

    // Act.
    await user.type(screen.getByLabelText('Email address'), 'victory@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.click(screen.getByLabelText('Remember me'))
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // Assert: on the dashboard, and the remember marker was written.
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(window.localStorage.getItem('conote:remember')).not.toBeNull()
  })
})
