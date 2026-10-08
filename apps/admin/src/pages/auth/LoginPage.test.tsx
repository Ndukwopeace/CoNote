/**
 * Tests for the admin sign-in page (admin brief, "Admin login").
 */

// Queries.
import { screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The real route table.
import { routes } from '@/app/routes'
// Demo credentials.
import { DEMO_PASSWORD } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders sign-in at `path` (default: no return address). */
function renderLogin(path = '/admin/login') {
  return renderWithRouter({ routes, path })
}

describe('LoginPage', () => {
  // Proves the page shows the brief's wording and fields, and no sign-up route.
  it('shows the heading, fields and button, and no sign-up', async () => {
    const { container } = renderLogin()
    await screen.findByRole('heading', { level: 1, name: 'CoNote Admin' })
    expect(screen.getByText('Sign in to manage the CoNote platform.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  // Proves the form checks the fields before calling the service.
  it('asks for a valid email and a password', async () => {
    const { user } = renderLogin()
    await user.click(await screen.findByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
  })

  // Proves wrong details show the service's single safe message.
  it('shows one message for wrong details', async () => {
    const { user } = renderLogin()
    await user.type(await screen.findByLabelText('Email'), 'admin@conote.example')
    await user.type(screen.getByLabelText('Password', { exact: true }), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
  })

  // Proves a successful sign-in goes to the page the admin first asked for.
  it('signs in and returns to the requested page', async () => {
    const { user, router } = renderLogin('/admin/login?redirect=%2Fadmin%2Fcourses')
    await user.type(await screen.findByLabelText('Email'), 'admin@conote.example')
    await user.type(screen.getByLabelText('Password', { exact: true }), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    await screen.findByRole('heading', { level: 1, name: 'Courses' })
    expect(router.state.location.pathname).toBe('/admin/courses')
  })

  // SECURITY: a return address pointing at another site is ignored (open redirect).
  it('ignores an unsafe return address', async () => {
    const { user, router } = renderLogin('/admin/login?redirect=%2F%2Fevil.example')
    await user.type(await screen.findByLabelText('Email'), 'admin@conote.example')
    await user.type(screen.getByLabelText('Password', { exact: true }), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    expect(router.state.location.pathname).toBe('/admin/dashboard')
  })

  // Proves the way to recover a forgotten password.
  it('links to the forgot-password page', async () => {
    renderLogin()
    expect(await screen.findByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/admin/forgot-password',
    )
  })

  // SECURITY: proves a notice only shows for a known key, never as text from navigation state.
  it('shows only known notices from navigation state', async () => {
    renderWithRouter({
      routes,
      path: { pathname: '/admin/login', state: { notice: 'Your account is locked' } },
    })
    await screen.findByRole('heading', { level: 1, name: 'CoNote Admin' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // Proves the demo hint names the demo account, so a reviewer can get in.
  it('shows the demo account in demo mode', async () => {
    renderLogin()
    expect(await screen.findByText('admin@conote.example')).toBeInTheDocument()
  })
})
