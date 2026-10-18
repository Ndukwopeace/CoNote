/**
 * Tests for the sign-up page (FR-AUTH-2, FR-AUTH-3), rendered inside the real routes.
 */

// Queries the rendered page.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// The shared error type.
import { AppError } from '@conote/core/errors'
// Remembers a sign-up that is waiting for its code.
import { rememberPendingSignup } from '@/lib/pendingSignup'
// An auth service that hangs.
import { authWith, hangingAuth } from '@/test/authServices'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// Services type.
import type { Services } from '@/services/types'
// Session type, for the code check.
import type { Session } from '@/types/auth'

/** Renders the sign-up page and waits for it to load. */
async function renderSignUp(services?: Partial<Services>) {
  // Render signed out.
  const result = renderWithRouter({ routes, path: '/signup', ...(services ? { services } : {}) })
  // Wait for the lazy page.
  await screen.findByRole('heading', { level: 1, name: 'Create your account' })
  // Hand back the tools.
  return result
}

/** Fills the form with a valid student and submits it. */
async function fillAndSubmit(user: Awaited<ReturnType<typeof renderSignUp>>['user']) {
  await user.type(screen.getByLabelText('Full name'), 'Ada Obi')
  await user.type(screen.getByLabelText('Email address'), 'ada@example.com')
  await user.type(screen.getByLabelText('Password'), 'password1')
  await user.type(screen.getByLabelText('Confirm password'), 'password1')
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: 'Sign up' }))
}

/**
 * An auth service whose sign-up asks for the emailed code. `base` is the demo service whose
 * session a successful check creates; `verifySignUpCode` replaces the check.
 */
function needsCode(
  base = authWith({}),
  verifySignUpCode: (email: string, code: string) => Promise<Session> = (email, code) =>
    base.verifySignUpCode(email, code),
) {
  return {
    ...base,
    signUp: () => Promise.resolve({ status: 'verify_code' as const }),
    verifySignUpCode,
  }
}

beforeEach(() => {
  // A remembered sign-up from one test must not show the code screen in the next.
  window.localStorage.clear()
})

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
    expect(screen.queryByRole('button', { name: /Microsoft/ })).toBeNull()
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

    // Assert: on Home, greeted by the new first name.
    expect(
      await screen.findByRole('heading', { level: 1, name: "Let's CoNote" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Good (morning|afternoon|evening), Ada\./)).toBeInTheDocument()
  })

  // Proves a backend that needs the email confirmed (D76) asks for the code it emailed, instead of
  // pretending the student is signed in.
  it('asks for the emailed code when confirmation is required', async () => {
    // Arrange: a service that reports "enter your code".
    const { user } = await renderSignUp({ auth: needsCode() })

    // Act.
    await fillAndSubmit(user)

    // Assert: the next step names the address, the form is gone, and the way back is offered.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Enter your code' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument()
    expect(screen.getByLabelText('Verification code')).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    )
    expect(screen.getByLabelText('Verification code')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.queryByRole('button', { name: 'Sign up' })).toBeNull()
  })

  // Proves the student is signed in the moment the sixth digit is typed, with no button to press.
  it('signs in as soon as the sixth digit is typed', async () => {
    // Arrange: one demo service; the code check signs its student in.
    const base = authWith({})
    const verifySignUpCode = vi.fn((email: string, code: string) =>
      base.completeProviderSignIn(`${email}/${code}`),
    )
    const { user } = await renderSignUp({ auth: needsCode(base, verifySignUpCode) })
    await fillAndSubmit(user)

    // Act: type the digits.
    await user.type(await screen.findByLabelText('Verification code'), '482913')

    // Assert: asked once with the address and the code, the remembered address is gone, and the
    // dashboard opens.
    expect(
      await screen.findByRole('heading', { level: 1, name: "Let's CoNote" }),
    ).toBeInTheDocument()
    expect(verifySignUpCode).toHaveBeenCalledTimes(1)
    expect(verifySignUpCode).toHaveBeenCalledWith('ada@example.com', '482913')
    expect(window.localStorage.getItem('conote:pending-signup')).toBeNull()
  })

  // Proves a code pasted with a space (as people copy it from the email) works.
  it('accepts a pasted code with a space in it', async () => {
    // Arrange.
    const base = authWith({})
    const verifySignUpCode = vi.fn((email: string, code: string) =>
      base.completeProviderSignIn(`${email}/${code}`),
    )
    const { user } = await renderSignUp({ auth: needsCode(base, verifySignUpCode) })
    await fillAndSubmit(user)

    // Act.
    await user.click(await screen.findByLabelText('Verification code'))
    await user.paste('482 913')

    // Assert.
    await screen.findByRole('heading', { level: 1, name: "Let's CoNote" })
    expect(verifySignUpCode).toHaveBeenCalledWith('ada@example.com', '482913')
  })

  // Proves a wrong code stays on the screen with a message that says what to do.
  it('says so when the code is wrong', async () => {
    // Arrange.
    const { user } = await renderSignUp({
      auth: needsCode(authWith({}), () =>
        Promise.reject(new AppError('validation', 'That code is not right or has expired.')),
      ),
    })
    await fillAndSubmit(user)

    // Act.
    await user.type(await screen.findByLabelText('Verification code'), '000000')

    // Assert.
    expect(await screen.findByText('That code is not right or has expired.')).toBeInTheDocument()
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument()
  })

  // Proves a short code is caught on the page, before anything is sent.
  it('asks for all six digits before sending', async () => {
    // Arrange.
    const verifySignUpCode = vi.fn()
    const { user } = await renderSignUp({ auth: needsCode(authWith({}), verifySignUpCode) })
    await fillAndSubmit(user)

    // Act.
    await user.type(await screen.findByLabelText('Verification code'), '482')
    await user.click(screen.getByRole('button', { name: 'Verify' }))

    // Assert.
    expect(await screen.findByText('Enter the 6-digit code.')).toBeInTheDocument()
    expect(verifySignUpCode).not.toHaveBeenCalled()
  })

  // Proves a new code can be asked for, the student is told, and the button waits before it can be
  // pressed again (the service limits how often an email goes out).
  it('sends a new code and waits before another', async () => {
    // Arrange.
    const resendSignUpCode = vi.fn(() => Promise.resolve())
    const { user } = await renderSignUp({
      auth: { ...needsCode(), resendSignUpCode },
    })
    await fillAndSubmit(user)

    // Act.
    await user.click(await screen.findByRole('button', { name: 'Send a new code' }))

    // Assert.
    expect(await screen.findByText(/new code is on its way/i)).toBeInTheDocument()
    expect(resendSignUpCode).toHaveBeenCalledWith('ada@example.com')
    expect(screen.getByRole('button', { name: /Send a new code in \d+s/ })).toBeDisabled()
  })

  // Proves a wrong address can be fixed: the form comes back, and the remembered step is dropped.
  it('goes back to the form to use a different email', async () => {
    // Arrange.
    const { user } = await renderSignUp({ auth: needsCode() })
    await fillAndSubmit(user)

    // Act.
    await user.click(await screen.findByRole('button', { name: 'Use a different email' }))

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem('conote:pending-signup')).toBeNull()
  })

  // Proves the code screen is still there after the page reloads, as happens on a phone when the
  // student switches to the email app and back.
  it('shows the code screen again after a reload', async () => {
    // Arrange: a sign-up from a minute ago is remembered.
    rememberPendingSignup('ada@example.com', new Date())

    // Act: open the sign-up page.
    window.localStorage.setItem('conote:keep', '1')
    renderWithRouter({ routes, path: '/signup', services: { auth: needsCode() } })

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Enter your code' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument()
  })

  // Proves the code screen has no accessibility problems.
  it('has no accessibility violations on the code screen', async () => {
    // Arrange.
    const { user, container } = await renderSignUp({ auth: needsCode() })
    await fillAndSubmit(user)
    await screen.findByRole('heading', { level: 1, name: 'Enter your code' })

    // Assert.
    await expectNoAxeViolations(container)
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
