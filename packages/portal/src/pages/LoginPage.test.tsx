/**
 * Tests for the staff sign-in page (admin brief "Admin login", teacher REQUIREMENTS section 5).
 */

// Queries.
import { screen, waitFor } from '@testing-library/react'
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

describe('LoginPage: sign in with an emailed code', () => {
  /** Opens the code sign-in and asks for a code for `email`; returns the demo code shown. */
  async function askForCode(
    user: ReturnType<typeof renderPortal>['user'],
    email: string = STAFF.email,
  ) {
    await user.click(await screen.findByRole('button', { name: 'Email me a sign-in code' }))
    await user.type(screen.getByLabelText('Email'), email)
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    const hint = await screen.findByTestId('demo-code')
    return /\d{6}/.exec(hint.textContent)?.[0] ?? ''
  }

  // Proves the code way in is offered next to the password form, which stays as it was.
  it('offers the code sign-in under the password form', async () => {
    renderPortal({ path: PATHS.login })

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Email me a sign-in code' })).toBeInTheDocument()
  })

  // Proves the code way in swaps the password field for an email-only form, and can be left.
  it('shows only the email at first, and can go back to the password', async () => {
    const { user, container } = renderPortal({ path: PATHS.login })

    await user.click(await screen.findByRole('button', { name: 'Email me a sign-in code' }))

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument()
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Sign in with a password instead' }))
    expect(screen.getByLabelText('Password', { exact: true })).toBeInTheDocument()
  })

  // Proves a malformed address is explained before anything is sent.
  it('asks for a valid email', async () => {
    const { user } = renderPortal({ path: PATHS.login })

    await user.click(await screen.findByRole('button', { name: 'Email me a sign-in code' }))
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
  })

  // Proves the second step names the address, shows the demo code, and has no stray password field.
  it('moves to the code step after the email', async () => {
    const { user, container } = renderPortal({ path: PATHS.login })

    await askForCode(user)

    expect(screen.getByText(STAFF.email, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByLabelText('Sign-in code')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password', { exact: true })).not.toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  // Proves the last digit signs the person in at once, and they land where a password sign-in lands.
  it('signs in when the last digit is typed', async () => {
    const { user, router } = renderPortal({ path: PATHS.login })

    const code = await askForCode(user)
    await user.type(screen.getByLabelText('Sign-in code'), code)

    await screen.findByRole('heading', { level: 1, name: 'Home page' })
    expect(router.state.location.pathname).toBe(PATHS.home)
  })

  // Proves the button works for anyone who pastes the code or prefers to press it.
  it('signs in with the button, and honours the requested page', async () => {
    const { user, router } = renderPortal({ path: `${PATHS.login}?redirect=%2Ft%2Fhome` })

    const code = await askForCode(user)
    await user.type(screen.getByLabelText('Sign-in code'), code.slice(0, 5))
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('Enter the 6-digit code.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Sign-in code'), code.slice(5))

    await screen.findByRole('heading', { level: 1, name: 'Home page' })
    expect(router.state.location.pathname).toBe(PATHS.home)
  })

  // SECURITY: proves a wrong code gives the one safe message and empties the field for another try.
  it('refuses a wrong code and clears the field', async () => {
    const { user } = renderPortal({ path: PATHS.login })

    const code = await askForCode(user)
    const wrong = code === '000000' ? '111111' : '000000'
    await user.type(screen.getByLabelText('Sign-in code'), wrong)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That code is not right or has expired. Ask for a new one.',
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Sign-in code')).toHaveValue('')
    })
  })

  // SECURITY: proves an address with no account reaches the same second step, so the form cannot
  // be used to find out who has an account.
  it('moves on for an address with no account, and signs nobody in', async () => {
    const { user } = renderPortal({ path: PATHS.login })

    const code = await askForCode(user, 'nobody@example.com')
    await user.type(screen.getByLabelText('Sign-in code'), code)

    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right')
  })

  // Proves an account an administrator switched off is told so, not shown the generic message.
  it('says when the account is not active', async () => {
    const { user } = renderPortal({
      path: PATHS.login,
      authOptions: { accountStatus: () => 'suspended' },
    })

    const code = await askForCode(user)
    await user.type(screen.getByLabelText('Sign-in code'), code)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account is not active. Contact your administrator.',
    )
  })

  // Proves a wrong address can be corrected, and the person returns to the email step.
  it('goes back to the email step to change the address', async () => {
    const { user } = renderPortal({ path: PATHS.login })

    await askForCode(user)
    await user.click(screen.getByRole('button', { name: 'Use a different email' }))

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sign-in code')).not.toBeInTheDocument()
  })

  // Proves a new code cannot be asked for straight away (the service limits how often an email
  // goes out), and the button says how long to wait.
  it('makes the person wait before asking for another code', async () => {
    const { user } = renderPortal({ path: PATHS.login })

    await askForCode(user)

    expect(screen.getByRole('button', { name: 'Send a new code in 60s' })).toBeDisabled()
  })
})
