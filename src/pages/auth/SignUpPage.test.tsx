/**
 * Tests for the sign-up page (FR-AUTH-2, FR-AUTH-3), rendered inside the real routes.
 */

// Queries the rendered page.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// An auth service that hangs.
import { hangingAuth } from '@/test/authServices'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// Services type.
import type { Services } from '@/services/types'

/** Renders the sign-up page and waits for it to load. */
async function renderSignUp(services?: Partial<Services>) {
  // Render signed out.
  const result = renderWithRouter({ routes, path: '/signup', ...(services ? { services } : {}) })
  // Wait for the lazy page.
  await screen.findByRole('heading', { level: 1, name: 'Create your account' })
  // Hand back the tools.
  return result
}

describe('SignUpPage', () => {
  // Proves every part of FR-AUTH-2 is present and accessible.
  it('shows every field, the terms checkbox and the providers', async () => {
    // Act.
    const { container } = await renderSignUp()

    // Assert: fields with the right autofill hints.
    expect(screen.getByLabelText('Full name')).toHaveAttribute('autocomplete', 'name')
    expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    // Assert: the terms links open the legal pages.
    expect(screen.getByRole('link', { name: /Terms of Service/ })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: /Privacy Policy/ })).toHaveAttribute('href', '/privacy')
    // Assert: both open in a new tab, so the half-filled form stays, and the installed app never
    // shows a public page (D36). SECURITY: noopener stops the new tab controlling this one.
    for (const name of ['Terms of Service', 'Privacy Policy']) {
      const link = screen.getByRole('link', { name: new RegExp(name) })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    // Assert: providers and the way back to sign in.
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    // Assert: accessible.
    await expectNoAxeViolations(container)
  })

  // Proves every rule is reported inline when an empty form is submitted (FR-AUTH-3).
  it('reports every problem on submit', async () => {
    // Arrange.
    const { user } = await renderSignUp()

    // Act.
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    // Assert: one message per field.
    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('Enter your full name.')
    expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription(
      'Enter your email address.',
    )
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter a password.')
    expect(screen.getByText(/Accept the Terms of Service/)).toBeInTheDocument()
  })

  // Proves the confirmation is checked as soon as the student leaves it.
  it('reports a mismatched confirmation when leaving the field', async () => {
    // Arrange.
    const { user } = await renderSignUp()

    // Act.
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.type(screen.getByLabelText('Confirm password'), 'password2')
    await user.tab()

    // Assert.
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  })

  // Proves the flow in MILESTONES M2's "done when": sign up and arrive on the dashboard.
  it('creates the account and opens the dashboard with the new name', async () => {
    // Arrange.
    const { user } = await renderSignUp()

    // Act: fill in everything and submit.
    await user.type(screen.getByLabelText('Full name'), 'Ada Obi')
    await user.type(screen.getByLabelText('Email address'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.type(screen.getByLabelText('Confirm password'), 'password1')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    // Assert: greeted by the new first name.
    expect(await screen.findByText(/Welcome, Ada/)).toBeInTheDocument()
  })

  // Proves the button shows progress while the account is created (FR-AUTH-6).
  it('disables the form while creating the account', async () => {
    // Arrange: a service that never answers.
    const { user } = await renderSignUp({ auth: hangingAuth() })

    // Act.
    await user.type(screen.getByLabelText('Full name'), 'Ada Obi')
    await user.type(screen.getByLabelText('Email address'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.type(screen.getByLabelText('Confirm password'), 'password1')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    // Assert.
    expect(await screen.findByRole('button', { name: 'Creating account…' })).toBeDisabled()
  })
})
