/**
 * Tests for the page Google sends the student back to (/auth/callback): it swaps the code in the
 * address for a session and moves on, or says plainly what went wrong.
 */

// Queries the rendered page.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The real route table.
import { routes } from '@/app/routes'
// Auth service variations.
import { authWith, hangingAuth } from '@/test/authServices'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the callback page at `path`, signed out, with `auth` standing in for the service. */
function renderCallback(path: string, auth = authWith({})) {
  return renderWithRouter({ routes, path, services: { auth } })
}

describe('AuthCallbackPage', () => {
  // Proves a code from Google signs the student in and the dashboard opens.
  it('signs in with the code and opens the dashboard', async () => {
    // Act.
    renderCallback('/auth/callback?code=google-code')

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), / }),
    ).toBeInTheDocument()
  })

  // Proves the code is used once, even if the page is rendered twice (React's development mode
  // does), since Google's code works only once.
  it('asks the service once for one code', async () => {
    // Arrange: one demo service, with its sign-in watched. Using the same service for the watch
    // and the render keeps the session the sign-in creates the one the page sees.
    const base = authWith({})
    const completeProviderSignIn = vi.fn((code: string | null) => base.completeProviderSignIn(code))

    // Act.
    renderCallback('/auth/callback?code=once', { ...base, completeProviderSignIn })
    await screen.findByRole('heading', { level: 1, name: /^Good / })

    // Assert.
    expect(completeProviderSignIn).toHaveBeenCalledTimes(1)
    expect(completeProviderSignIn).toHaveBeenCalledWith('once')
  })

  // Proves the wait is announced instead of showing a blank page.
  it('says it is finishing the sign-in while it waits', async () => {
    // Act.
    const { container } = renderCallback('/auth/callback?code=slow', hangingAuth())

    // Assert.
    expect(await screen.findByText('Finishing your sign-in…')).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  // Proves a student who closed Google's window gets a plain message and a way back, and the
  // service is never asked to sign anyone in.
  it('explains a cancelled Google sign-in', async () => {
    // Arrange.
    const completeProviderSignIn = vi.fn()

    // Act.
    const { container } = renderCallback(
      '/auth/callback?error=access_denied&error_description=The+user+denied+access',
      authWith({ completeProviderSignIn }),
    )

    // Assert: the message is ours, not Google's text from the address.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Google sign-in did not finish' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument()
    expect(screen.queryByText(/denied access/i)).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
    expect(completeProviderSignIn).not.toHaveBeenCalled()
    await expectNoAxeViolations(container)
  })

  // Proves an address with no code (someone typed it) ends on the same screen.
  it('refuses an address with no code', async () => {
    // Act.
    renderCallback('/auth/callback')

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Google sign-in did not finish' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument()
  })

  // Proves a failed exchange shows the service's student-facing wording and a way back.
  it('shows why the sign-in failed', async () => {
    // Act.
    renderCallback(
      '/auth/callback?code=bad',
      authWith({
        completeProviderSignIn: () =>
          Promise.reject(new AppError('forbidden', 'This account is not active.')),
      }),
    )

    // Assert: the forbidden wording from errorMessages, never the raw text.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Google sign-in did not finish' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/You don't have access to this/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument()
  })

  // Proves a dropped connection is explained as one.
  it('explains a dropped connection', async () => {
    // Act.
    renderCallback(
      '/auth/callback?code=offline',
      authWith({
        completeProviderSignIn: () => Promise.reject(new AppError('network', 'offline')),
      }),
    )

    // Assert.
    expect(await screen.findByText(/couldn't reach CoNote/i)).toBeInTheDocument()
  })
})
