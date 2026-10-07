/**
 * Tests for the console's reset-password page.
 */

// Queries.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The real route table.
import { routes } from '@/app/routes'
// Render helper and the demo service it builds.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'

/** A fresh, valid reset link for the demo admin. */
async function freshLink() {
  const request = await createTestServices().auth.requestPasswordReset('admin@conote.example')
  return request.demoResetPath ?? ''
}

describe('ResetPasswordPage', () => {
  // SECURITY: proves a link with no code, or a made-up one, never shows the form.
  it.each(['/admin/reset-password', '/admin/reset-password?code=made-up'])(
    'refuses %s',
    async (path) => {
      const { container } = renderWithRouter({ routes, path })
      await screen.findByRole('heading', { level: 1, name: 'This link has expired' })
      expect(screen.queryByLabelText('New password', { exact: true })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
        'href',
        '/admin/forgot-password',
      )
      await expectNoAxeViolations(container)
    },
  )

  // Proves the rules show before anything is sent.
  it('checks the new password and the confirmation', async () => {
    const { user } = renderWithRouter({ routes, path: await freshLink() })
    await user.type(await screen.findByLabelText('New password', { exact: true }), 'short1')
    await user.type(screen.getByLabelText('Confirm new password', { exact: true }), 'short2')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByText('Use at least 12 characters.')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  // Proves a successful reset ends on sign-in, with a confirmation, and the new password works.
  it('updates the password and confirms on sign-in', async () => {
    const { user, container, router } = renderWithRouter({ routes, path: await freshLink() })
    await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })
    await expectNoAxeViolations(container)
    await user.type(screen.getByLabelText('New password', { exact: true }), 'new-password-2026')
    await user.type(
      screen.getByLabelText('Confirm new password', { exact: true }),
      'new-password-2026',
    )
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    await screen.findByRole('heading', { level: 1, name: 'CoNote Admin' })
    expect(router.state.location.pathname).toBe('/admin/login')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your password has been updated. Sign in with your new password.',
    )
    // The new password signs in.
    await user.type(screen.getByLabelText('Email'), 'admin@conote.example')
    await user.type(screen.getByLabelText('Password', { exact: true }), 'new-password-2026')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  // Proves a link used up in another tab while this page was open fails safely, with a message.
  it('explains when the link was used up meanwhile', async () => {
    const path = await freshLink()
    const { user } = renderWithRouter({ routes, path })
    await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })
    // Another request replaces the link.
    await createTestServices().auth.requestPasswordReset('admin@conote.example')
    await user.type(screen.getByLabelText('New password', { exact: true }), 'new-password-2026')
    await user.type(
      screen.getByLabelText('Confirm new password', { exact: true }),
      'new-password-2026',
    )
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This reset link has expired. Request a new one.',
    )
  })
})
