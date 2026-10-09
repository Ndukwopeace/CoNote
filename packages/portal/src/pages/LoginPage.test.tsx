/**
 * Tests for the staff sign-in page (admin brief "Admin login", teacher REQUIREMENTS section 5).
 */

// Queries.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The test portal.
import { PASSWORD, PATHS, STAFF, renderPortal } from '../test/harness'

describe('LoginPage', () => {
  // Proves the page shows the heading, subtitle and fields, and no sign-up route.
  it('shows the heading, fields and button, and no sign-up', async () => {
    const { container } = renderPortal({ path: PATHS.login })

    await screen.findByRole('heading', { level: 1, name: 'CoNote Test' })
    expect(screen.getByText('Sign in to test.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  // Proves the form checks the fields before calling the service.
  it('asks for a valid email and a password', async () => {
    const { user } = renderPortal({ path: PATHS.login })

    await user.click(await screen.findByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
  })

  // Proves wrong details show the service's single safe message.
  it('shows one message for wrong details', async () => {
    const { user } = renderPortal({ path: PATHS.login })

    await user.type(await screen.findByLabelText('Email'), STAFF.email)
    await user.type(screen.getByLabelText('Password', { exact: true }), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
  })

  // Proves an account an administrator deactivated or suspended is told so after the right password.
  it('says when the account is not active', async () => {
    const { user } = renderPortal({
      path: PATHS.login,
      authOptions: { accountStatus: () => 'suspended' },
    })

    await user.type(await screen.findByLabelText('Email'), STAFF.email)
    await user.type(screen.getByLabelText('Password', { exact: true }), PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account is not active. Contact your administrator.',
    )
  })

  // Proves a successful sign-in goes to the page the user first asked for.
  it('signs in and returns to the requested page', async () => {
    const { user, router } = renderPortal({ path: `${PATHS.login}?redirect=%2Ft%2Fhome` })

    await user.type(await screen.findByLabelText('Email'), STAFF.email)
    await user.type(screen.getByLabelText('Password', { exact: true }), PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await screen.findByRole('heading', { level: 1, name: 'Home page' })
    expect(router.state.location.pathname).toBe(PATHS.home)
  })

  // SECURITY: a return address pointing at another site is ignored (open redirect).
  it('ignores an unsafe return address', async () => {
    const { user, router } = renderPortal({ path: `${PATHS.login}?redirect=%2F%2Fevil.example` })

    await user.type(await screen.findByLabelText('Email'), STAFF.email)
    await user.type(screen.getByLabelText('Password', { exact: true }), PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await screen.findByRole('heading', { level: 1, name: 'Home page' })
    expect(router.state.location.pathname).toBe(PATHS.home)
  })

  // Proves the way to recover a forgotten password.
  it('links to the forgot-password page', async () => {
    renderPortal({ path: PATHS.login })

    expect(await screen.findByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      PATHS.forgot,
    )
  })

  // SECURITY: proves a notice only shows for a known key, never as text from navigation state.
  it('shows only known notices from navigation state', async () => {
    renderPortal({ path: { pathname: PATHS.login, state: { notice: 'Your account is locked' } } })

    await screen.findByRole('heading', { level: 1, name: 'CoNote Test' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // Proves the demo hint names the demo account when the portal gives one, so a reviewer can get in.
  it('shows the demo account when the portal gives one', async () => {
    renderPortal({ path: PATHS.login })

    expect(await screen.findByText(STAFF.email)).toBeInTheDocument()
  })
})
