/**
 * Tests for who gets into the teacher portal: signed-out visitors go to sign-in, non-teachers see a
 * notice, teachers get in (teacher REQUIREMENTS section 3).
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

describe('teacher route guard', () => {
  // Proves a signed-out visitor is sent to sign-in, with the page they wanted remembered.
  it('sends a signed-out visitor to sign-in, remembering the page', async () => {
    const { router } = renderWithRouter({ routes, path: '/teacher/courses?tab=x' })
    await screen.findByRole('heading', { level: 1, name: 'CoNote Teacher' })
    expect(router.state.location.pathname).toBe('/teacher/login')
    expect(router.state.location.search).toBe('?redirect=%2Fteacher%2Fcourses%3Ftab%3Dx')
  })

  // SECURITY: a teacher's or student's account authenticates but never opens the portal
  // (privilege escalation). The backend's RLS enforces the same rule; this is the UI side.
  it.each(['admin', 'student'] as const)('shows a %s the teachers-only notice', async (role) => {
    renderWithRouter({ routes, path: '/teacher/courses', session: makeSession(role) })
    await screen.findByRole('heading', { level: 1, name: 'This portal is for teachers' })
    expect(screen.queryByRole('navigation', { name: 'Teacher navigation' })).not.toBeInTheDocument()
  })

  // Proves the notice's sign-out button works, ending on sign-in.
  it('lets a non-teacher sign out from the notice', async () => {
    const { user, router } = renderWithRouter({
      routes,
      path: '/teacher/courses',
      session: makeSession('student'),
    })
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { level: 1, name: 'CoNote Teacher' })
    expect(router.state.location.pathname).toBe('/teacher/login')
  })

  // Proves a teacher gets the page they asked for.
  it('lets a teacher in', async () => {
    const { router } = renderWithRouter({
      routes,
      path: '/teacher/courses',
      session: makeSession('teacher'),
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'My courses' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/teacher/courses')
  })

  // Proves a teacher who opens sign-in is sent on to My courses.
  it('sends a signed-in teacher away from sign-in', async () => {
    const { router } = renderWithRouter({
      routes,
      path: '/teacher/login',
      session: makeSession('teacher'),
    })
    await screen.findByRole('heading', { level: 1, name: 'My courses' })
    expect(router.state.location.pathname).toBe('/teacher/courses')
  })

  // Proves signing out from the account menu ends on sign-in and forgets the session.
  it('signs out from the account menu', async () => {
    const { user, router } = renderWithRouter({
      routes,
      path: '/teacher/courses',
      session: makeSession('teacher'),
    })
    await user.click(await screen.findByRole('button', { name: 'Account menu for Sarah Mbarga' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await screen.findByRole('heading', { level: 1, name: 'CoNote Teacher' })
    expect(router.state.location.pathname).toBe('/teacher/login')
    await waitFor(() => {
      expect(window.sessionStorage).toHaveLength(0)
    })
  })
})
