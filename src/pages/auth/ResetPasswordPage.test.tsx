/**
 * Tests for the reset-password page (FR-AUTH-5): valid link, expired link, loading and errors.
 */

// Queries the rendered page.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Auth service variations.
import { authWith, offlineAuth } from '@/test/authServices'
// Render helper and the demo services.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'
// Services type.
import type { Services } from '@/services/types'

/** Asks the demo service for a reset link, as the forgot page would, and returns its address. */
async function demoResetPath() {
  // Request a reset; the demo returns the link instead of emailing it.
  const { demoResetPath: path } =
    await createTestServices().auth.requestPasswordReset('victory@example.com')
  // The demo always returns one; fail loudly if that ever changes.
  if (!path) throw new Error('The demo service returned no reset link')
  // e.g. "/reset-password?code=…".
  return path
}

/** Renders the reset page at `path`. */
function renderReset(path: string, services?: Partial<Services>) {
  // Render signed out.
  return renderWithRouter({ routes, path, ...(services ? { services } : {}) })
}

describe('ResetPasswordPage', () => {
  // Proves a valid link shows the form.
  it('shows the new-password form for a valid link', async () => {
    // Act.
    const { container } = renderReset(await demoResetPath())

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Choose a new password' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  // Proves missing and bad codes get the expired state with no fields (FR-AUTH-5): [path].
  it.each([['/reset-password'], ['/reset-password?code=made-up']])(
    'shows the expired state for %s',
    async (path) => {
      // Act.
      const { container } = renderReset(path)

      // Assert: the expired heading and the way to a new link...
      expect(
        await screen.findByRole('heading', { level: 1, name: 'This reset link has expired' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
        'href',
        '/forgot-password',
      )
      // ...and no password fields.
      expect(screen.queryByLabelText('New password')).toBeNull()
      await expectNoAxeViolations(container)
    },
  )

  // Proves the page says it is checking, rather than flashing the form or the expired state.
  it('shows a loading state while the link is checked', async () => {
    // Act: a service that never answers.
    renderReset('/reset-password?code=x', {
      auth: authWith({ checkResetLink: () => new Promise<boolean>(() => undefined) }),
    })

    // Assert.
    expect(await screen.findByText('Checking your reset link…')).toBeInTheDocument()
  })

  // Proves a failed check offers a retry instead of wrongly calling the link expired.
  it('shows an error with a retry when the link cannot be checked', async () => {
    // Act.
    renderReset('/reset-password?code=x', { auth: offlineAuth() })

    // Assert.
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't reach CoNote")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the rules apply to the new password.
  it('rejects a weak new password inline', async () => {
    // Arrange.
    const { user } = renderReset(await demoResetPath())
    await screen.findByLabelText('New password')

    // Act.
    await user.type(screen.getByLabelText('New password'), 'password')
    await user.type(screen.getByLabelText('Confirm new password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    // Assert.
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
      'Include at least one number.',
    )
  })

  // Proves the success path: new password saved, then sign in with the notice (FR-AUTH-5).
  it('updates the password and sends the student to sign in with a notice', async () => {
    // Arrange.
    const { user, router } = renderReset(await demoResetPath())
    await screen.findByLabelText('New password')

    // Act.
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    // Assert: on the sign-in page with the notice.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome back' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Your password has been updated.')
    // SECURITY: the code is gone from the address, so it isn't left in the browser history.
    expect(router.state.location.search).toBe('')
  })
})
