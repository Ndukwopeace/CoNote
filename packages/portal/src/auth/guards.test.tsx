/**
 * Tests for the role guards and the sign-in state: signed-out visitors go to sign-in, other roles
 * see a notice, the portal's own role gets in, and sign-out forgets what the portal stored.
 */

// Queries and waiting.
import { screen, waitFor } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The test portal.
import { PATHS, PREFIX, STAFF, STUDENT, createTestAuth, renderPortal } from '../test/harness'

describe('role guards', () => {
  // Proves a signed-out visitor is sent to sign-in, with the page they wanted remembered.
  it('sends a signed-out visitor to sign-in, remembering the page', async () => {
    const { router } = renderPortal({ path: `${PATHS.home}?tab=x` })

    await screen.findByRole('heading', { level: 1, name: 'CoNote Test' })
    expect(router.state.location.pathname).toBe(PATHS.login)
    expect(router.state.location.search).toBe('?redirect=%2Ft%2Fhome%3Ftab%3Dx')
  })

  // SECURITY: another role's account authenticates but never opens the portal (privilege
  // escalation). The backend's RLS enforces the same rule; this is the UI side.
  it('shows another role the wrong-role notice, without the frame', async () => {
    renderPortal({ path: PATHS.home, session: { user: STUDENT } })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This portal is for staff' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Test navigation' })).not.toBeInTheDocument()
  })

  // Proves the notice's sign-out button works, ending on sign-in.
  it('lets another role sign out from the notice', async () => {
    const { user, router } = renderPortal({ path: PATHS.home, session: { user: STUDENT } })

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    await screen.findByRole('heading', { level: 1, name: 'CoNote Test' })
    expect(router.state.location.pathname).toBe(PATHS.login)
  })

  // Proves the portal's own role gets the page they asked for.
  it('lets the portal’s role in', async () => {
    const { router } = renderPortal({ path: PATHS.home, session: { user: STAFF } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Home page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(PATHS.home)
  })

  // Proves a signed-in user who opens sign-in is sent on to the portal's home.
  it('sends a signed-in user away from sign-in', async () => {
    const { router } = renderPortal({ path: PATHS.login, session: { user: STAFF } })

    await screen.findByRole('heading', { level: 1, name: 'Home page' })
    expect(router.state.location.pathname).toBe(PATHS.home)
  })

  // Proves another role who opens sign-in sees the notice too.
  it('shows another role the notice on the sign-in address', async () => {
    renderPortal({ path: PATHS.login, session: { user: STUDENT } })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This portal is for staff' }),
    ).toBeInTheDocument()
  })

  // SECURITY: signing out forgets the portal's stored keys and the query cache, and keeps other
  // apps' keys (shared-computer data exposure).
  it('clears the portal’s storage and the query cache on sign-out', async () => {
    window.localStorage.setItem(`${PREFIX}filters`, 'x')
    window.localStorage.setItem('conote:other-app', 'keep')
    const { user, router, queryClient } = renderPortal({
      path: PATHS.home,
      session: { user: STAFF },
    })
    queryClient.setQueryData(['loaded'], 'data')

    await user.click(await screen.findByRole('button', { name: 'Account menu for Sam Staff' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(PATHS.login)
    })
    expect(window.localStorage.getItem(`${PREFIX}filters`)).toBeNull()
    expect(window.sessionStorage).toHaveLength(0)
    expect(window.localStorage.getItem('conote:other-app')).toBe('keep')
    expect(queryClient.getQueryData(['loaded'])).toBeUndefined()
  })

  // Proves signing out always works locally, even when the server call fails.
  it('signs out locally when the service fails', async () => {
    const real = createTestAuth()
    const auth = { ...real, signOut: vi.fn().mockRejectedValue(new Error('offline')) }
    const { user, router } = renderPortal({ path: PATHS.home, session: { user: STAFF }, auth })

    await user.click(await screen.findByRole('button', { name: 'Account menu for Sam Staff' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(PATHS.login)
    })
  })

  // Proves a broken session check ends as signed out, never a stuck spinner.
  it('treats a failed session check as signed out', async () => {
    const real = createTestAuth()
    const auth = { ...real, getSession: vi.fn().mockRejectedValue(new Error('down')) }
    renderPortal({ path: PATHS.home, auth })

    await screen.findByRole('heading', { level: 1, name: 'CoNote Test' })
  })
})
