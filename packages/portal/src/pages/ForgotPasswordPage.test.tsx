/**
 * Tests for the staff forgot-password page.
 */

// Queries.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The test portal.
import { PATHS, STAFF, renderPortal } from '../test/harness'

describe('ForgotPasswordPage', () => {
  // Proves the page explains itself and offers a way back.
  it('asks for the email, with a way back to sign-in', async () => {
    const { container } = renderPortal({ path: PATHS.forgot })

    await screen.findByRole('heading', { level: 1, name: 'Reset your password' })
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      PATHS.login,
    )
    await expectNoAxeViolations(container)
  })

  // Proves the email is checked first.
  it('checks the email', async () => {
    const { user } = renderPortal({ path: PATHS.forgot })

    await user.click(await screen.findByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
  })

  // SECURITY: proves the same confirmation appears for an unknown email (account enumeration).
  it.each([STAFF.email, 'nobody@example.com'])(
    'gives the same answer for %s, with the demo link',
    async (email) => {
      const { user } = renderPortal({ path: PATHS.forgot })

      await user.type(await screen.findByLabelText('Email'), email)
      await user.click(screen.getByRole('button', { name: 'Send reset link' }))

      expect(
        await screen.findByText(
          'If an account exists for that email, we sent a link to reset its password.',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Continue to reset (demo)' })).toHaveAttribute(
        'href',
        expect.stringMatching(/^\/t\/reset-password\?code=/) as string,
      )
    },
  )
})
