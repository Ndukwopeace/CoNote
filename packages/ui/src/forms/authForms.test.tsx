/**
 * Tests for the shared password-recovery forms: the reset-link request and the new password.
 * Each app supplies its own rules (as a resolver) and wording; these tests prove the shared
 * behaviour with sample rules.
 */

// Connects the sample zod rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// Rendering and queries.
import { render, screen } from '@testing-library/react'
// Simulated user input.
import userEvent from '@testing-library/user-event'
// The forms render links, which need a router.
import { MemoryRouter } from 'react-router'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'
// Sample rules.
import { z } from 'zod'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The components under test.
import { NewPasswordForm } from './NewPasswordForm'
import { ResetRequestForm } from './ResetRequestForm'

/** Sample email rules. */
const emailSchema = z.object({ email: z.email('Enter a valid email address.') })

/** Sample new-password rules: a length and a matching confirmation. */
const passwordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

/** Renders the request form with the given overrides. */
function renderRequestForm(overrides: Partial<Parameters<typeof ResetRequestForm>[0]> = {}) {
  // A spy for the submit, so tests can see what was sent.
  const onSubmit = vi.fn()
  // The form with sample wording.
  const view = render(
    <MemoryRouter>
      <ResetRequestForm
        resolver={zodResolver(emailSchema)}
        intro="Enter your email."
        emailLabel="Email address"
        emailAutoComplete="email"
        confirmation="If an account exists for that email, we sent a reset link."
        sent={null}
        error={null}
        isPending={false}
        onSubmit={onSubmit}
        {...overrides}
      />
    </MemoryRouter>,
  )
  return { ...view, onSubmit }
}

/** Renders the new-password form with the given overrides. */
function renderPasswordForm(overrides: Partial<Parameters<typeof NewPasswordForm>[0]> = {}) {
  // A spy for the submit, so tests can see what was saved.
  const onSubmit = vi.fn()
  // The form with sample rules.
  const view = render(
    <NewPasswordForm
      resolver={zodResolver(passwordSchema)}
      minLength={8}
      error={null}
      isPending={false}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { ...view, onSubmit }
}

describe('ResetRequestForm', () => {
  // Proves the form shows the app's wording and passes an accessibility check.
  it('shows the intro and the labelled email field', async () => {
    // Act.
    const { container } = renderRequestForm()

    // Assert.
    expect(screen.getByText('Enter your email.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'email')
    await expectNoAxeViolations(container)
  })

  // Proves the app's rules run before anything is sent.
  it('shows the rule message and sends nothing for a malformed email', async () => {
    // Arrange.
    const user = userEvent.setup()
    const { onSubmit } = renderRequestForm()

    // Act.
    await user.type(screen.getByLabelText('Email address'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    // Assert.
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // Proves a well-formed email is handed to the caller.
  it('sends the email', async () => {
    // Arrange.
    const user = userEvent.setup()
    const { onSubmit } = renderRequestForm()

    // Act.
    await user.type(screen.getByLabelText('Email address'), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    // Assert.
    expect(onSubmit).toHaveBeenCalledWith('ada@example.com')
  })

  // Proves a failed request's message is shown.
  it('shows the request error', () => {
    // Act.
    renderRequestForm({ error: 'Something went wrong.' })

    // Assert.
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  // Proves the button can't be pressed twice while a request is running.
  it('disables and relabels the button while sending', () => {
    // Act.
    renderRequestForm({ isPending: true })

    // Assert.
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
  })

  // Proves the confirmation replaces the form once sent.
  it('shows the confirmation instead of the form once sent', () => {
    // Act.
    renderRequestForm({ sent: {} })

    // Assert.
    expect(
      screen.getByText('If an account exists for that email, we sent a reset link.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Continue to reset (demo)' })).not.toBeInTheDocument()
  })

  // Proves the demo link appears only when the service hands one back.
  it('offers the demo link when one is returned', () => {
    // Act.
    renderRequestForm({ sent: { demoResetPath: '/reset-password?code=abc' } })

    // Assert.
    expect(screen.getByRole('link', { name: 'Continue to reset (demo)' })).toHaveAttribute(
      'href',
      '/reset-password?code=abc',
    )
  })
})

describe('NewPasswordForm', () => {
  // Proves the rules are stated up front and the form passes an accessibility check.
  it('states the rules and labels both fields', async () => {
    // Act.
    const { container } = renderPasswordForm({ minLength: 12 })

    // Assert.
    expect(
      screen.getByText('Use at least 12 characters, with a letter and a number.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('New password', { exact: true })).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    expect(screen.getByLabelText('Confirm new password', { exact: true })).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    await expectNoAxeViolations(container)
  })

  // Proves the app's rules run before anything is saved.
  it('shows the rule message and saves nothing when the passwords differ', async () => {
    // Arrange.
    const user = userEvent.setup()
    const { onSubmit } = renderPasswordForm()

    // Act.
    await user.type(screen.getByLabelText('New password', { exact: true }), 'long-enough-1')
    await user.type(screen.getByLabelText('Confirm new password', { exact: true }), 'different-1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    // Assert.
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // Proves a valid password is handed to the caller.
  it('saves the new password', async () => {
    // Arrange.
    const user = userEvent.setup()
    const { onSubmit } = renderPasswordForm()

    // Act.
    await user.type(screen.getByLabelText('New password', { exact: true }), 'long-enough-1')
    await user.type(screen.getByLabelText('Confirm new password', { exact: true }), 'long-enough-1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    // Assert.
    expect(onSubmit).toHaveBeenCalledWith('long-enough-1')
  })

  // Proves a failed save's message is shown.
  it('shows the save error', () => {
    // Act.
    renderPasswordForm({ error: 'This reset link has expired.' })

    // Assert.
    expect(screen.getByRole('alert')).toHaveTextContent('This reset link has expired.')
  })

  // Proves the button can't be pressed twice while a save is running.
  it('disables and relabels the button while saving', () => {
    // Act.
    renderPasswordForm({ isPending: true })

    // Assert.
    expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled()
  })
})
