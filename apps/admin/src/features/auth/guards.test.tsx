/**
 * Tests for who gets into the admin console: signed-out visitors go to sign-in, non-admins see a
 * notice, admins get in (admin brief, "Admin authentication").
 */

// Queries and waiting.
import { screen, waitFor } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

describe('admin route guard', () => {
  // Proves a signed-out visitor is sent to sign-in, with the page they wanted remembered.
  it('sends a signed-out visitor to sign-in, remembering the page', async () => {
    const { router } = renderWithRouter({ routes, path: '/admin/users?tab=teachers' })
    await screen.findByRole('heading', { level: 1, name: 'CoNote Admin' })
    expect(router.state.location.pathname).toBe('/admin/login')
    expect(router.state.location.search).toBe('?redirect=%2Fadmin%2Fusers%3Ftab%3Dteachers')
  })

  // SECURITY: a teacher's or student's account authenticates but never opens the console
  // (privilege escalation). The backend's RLS enforces the same rule; this is the UI side.
  it.each(['teacher', 'student'] as const)(
    'shows a %s the administrators-only notice',
    async (role) => {
      renderWithRouter({ routes, path: '/admin/dashboard', session: makeSession(role) })
      await screen.findByRole('heading', { level: 1, name: 'This console is for administrators' })
      expect(screen.queryByRole('navigation', { name: 'Admin navigation' })).not.toBeInTheDocument()
    },
  )

  // Proves the notice's sign-out button works, ending on sign-in.
  it('lets a non-admin sign out from the notice', async () => {
    const { user, router } = renderWithRouter({
      routes,
      path: '/admin/dashboard',
      session: makeSession('teacher'),
    })
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { level: 1, name: 'CoNote Admin' })
    expect(router.state.location.pathname).toBe('/admin/login')
  })

  // Proves an admin gets the page they asked for.
  it('lets an admin in', async () => {
    const { router } = renderWithRouter({
      routes,
      path: '/admin/users',
      session: makeSession('admin'),
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/users')
  })

  // Proves an admin who opens sign-in is sent on to the dashboard.
  it('sends a signed-in admin away from sign-in', async () => {
    const { router } = renderWithRouter({
      routes,
      path: '/admin/login',
      session: makeSession('admin'),
    })
    await screen.findByRole('heading', { level: 1, name: /^Good / })
    expect(router.state.location.pathname).toBe('/admin/dashboard')
  })

  // Proves signing out from the account menu ends on sign-in and forgets the session.
  it('signs out from the account menu', async () => {
    const { user, router } = renderWithRouter({
      routes,
      path: '/admin/dashboard',
      session: makeSession('admin'),
    })
    await user.click(await screen.findByRole('button', { name: 'Account menu for Amara Okafor' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await screen.findByRole('heading', { level: 1, name: 'CoNote Admin' })
    expect(router.state.location.pathname).toBe('/admin/login')
    await waitFor(() => {
      expect(window.sessionStorage).toHaveLength(0)
    })
  })
})
