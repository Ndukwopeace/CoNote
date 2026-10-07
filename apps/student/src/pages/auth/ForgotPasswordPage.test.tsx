/**
 * Tests for the forgot-password page (FR-AUTH-4, FR-AUTH-7).
 */

// Queries the rendered page.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Auth service variations.
import { authWith, offlineAuth } from '@/test/authServices'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// Services type.
import type { Services } from '@/services/types'

/** Renders the forgot-password page and waits for it to load. */
async function renderForgot(services?: Partial<Services>) {
  // Render signed out.
  const result = renderWithRouter({
    routes,
    path: '/forgot-password',
    ...(services ? { services } : {}),
  })
  // Wait for the lazy page.
  await screen.findByRole('heading', { level: 1, name: 'Reset your password' })
  // Hand back the tools.
  return result
}

/** The generic confirmation from FR-AUTH-4. */
const CONFIRMATION = 'If an account exists for that email, we sent a reset link.'

describe('ForgotPasswordPage', () => {
  // Proves the form is accessible and links back to sign in.
  it('shows the email form and a way back to sign in', async () => {
    // Act.
    const { container } = await renderForgot()

    // Assert.
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
    await expectNoAxeViolations(container)
  })

  // Proves a malformed email is caught inline.
  it('rejects a malformed email inline', async () => {
    // Arrange.
    const { user } = await renderForgot()

    // Act.
    await user.type(screen.getByLabelText('Email address'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    // Assert.
    expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription(
      'Enter a valid email address.',
    )
  })

  // Proves the generic answer and the demo shortcut (FR-AUTH-4, FR-AUTH-7).
  it('shows the generic confirmation and the demo reset link', async () => {
    // Arrange.
    const { user, container } = await renderForgot()

    // Act.
    await user.type(screen.getByLabelText('Email address'), 'victory@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    // Assert: the wording never says whether the account exists.
    expect(await screen.findByRole('status')).toHaveTextContent(CONFIRMATION)
    // Assert: the demo link carries a code.
    expect(screen.getByRole('link', { name: 'Continue to reset (demo)' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/reset-password\?code=/),
    )
    // Assert: still accessible in the confirmation state.
    await expectNoAxeViolations(container)
  })

  // Proves the demo link appears only when the service returns one (a real service never does).
  it('hides the demo link when the service sends a real email', async () => {
    // Arrange: a service that returns no link.
    const { user } = await renderForgot({
      auth: authWith({ requestPasswordReset: () => Promise.resolve({}) }),
    })

    // Act.
    await user.type(screen.getByLabelText('Email address'), 'victory@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    // Assert.
    expect(await screen.findByRole('status')).toHaveTextContent(CONFIRMATION)
    expect(screen.queryByRole('link', { name: 'Continue to reset (demo)' })).toBeNull()
  })

  // Proves a failed request is reported rather than pretending an email was sent.
  it('shows an error when the request fails', async () => {
    // Arrange.
    const { user } = await renderForgot({ auth: offlineAuth() })

    // Act.
    await user.type(screen.getByLabelText('Email address'), 'victory@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    // Assert.
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't reach CoNote")
    expect(screen.queryByText(CONFIRMATION)).toBeNull()
  })
})
