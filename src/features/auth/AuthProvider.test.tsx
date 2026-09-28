/**
 * Tests for AuthProvider: loading the session, following changes, and the sign-out clean-up.
 */

// screen queries the page; waitFor retries an assertion until it passes or times out.
import { screen, waitFor } from '@testing-library/react'
// Vitest building blocks; vi.mock replaces a module.
import { describe, expect, it, vi } from 'vitest'

// The error type a failing service throws.
import { AppError } from '@/lib/errors'
// The reporter (replaced by a recording fake below).
import { reportError } from '@/lib/reportError'

// Storage key builder, to plant data to be cleared.
import { storageKey } from '@/lib/storage'
// Session factory.
import { makeSession } from '@/test/factories'
// Test services and the render helper.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'

// The hook the probe below reads.
import { useAuth } from './useAuth'

// Replace the reporter with a recording fake, so tests can check what was reported.
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }))

/** A tiny component that shows the auth state and offers sign-in and sign-out buttons. */
function AuthProbe() {
  // Read state and actions.
  const { status, session, signIn, signOut } = useAuth()
  return (
    <div>
      {/* Current status, for assertions. */}
      <p>status: {status}</p>
      {/* Current user's name, or "none". */}
      <p>user: {session?.user.fullName ?? 'none'}</p>
      {/* Sign in with fixed demo credentials. */}
      <button
        type="button"
        onClick={() => void signIn({ email: 'v@example.com', password: 'x', remember: true })}
      >
        sign in
      </button>
      {/* Sign out. */}
      <button type="button" onClick={() => void signOut()}>
        sign out
      </button>
    </div>
  )
}

// Mount the probe at "/".
const routes = [{ path: '/', element: <AuthProbe /> }]

describe('AuthProvider', () => {
  // Proves a first-time visitor is signed out.
  it('reports signed out when there is no stored session', async () => {
    // Act.
    renderWithRouter({ routes, path: '/' })

    // Assert.
    expect(await screen.findByText('status: signedOut')).toBeInTheDocument()
  })

  // Proves a returning student stays signed in after a reload.
  it('restores a stored session', async () => {
    // Act: start with a stored session.
    renderWithRouter({ routes, path: '/', session: makeSession({ fullName: 'Ada Obi' }) })

    // Assert: the right user and status.
    expect(await screen.findByText('user: Ada Obi')).toBeInTheDocument()
    expect(screen.getByText('status: signedIn')).toBeInTheDocument()
  })

  // Proves sign-in updates every screen through the provider.
  it('updates when the student signs in', async () => {
    // Arrange: signed out.
    const { user } = renderWithRouter({ routes, path: '/' })
    await screen.findByText('status: signedOut')

    // Act.
    await user.click(screen.getByRole('button', { name: 'sign in' }))

    // Assert.
    expect(await screen.findByText('status: signedIn')).toBeInTheDocument()
  })

  // SECURITY: proves sign-out leaves nothing for the next person on a shared computer (NFR-4).
  it('clears the session, cached data, drafts and AI conversation on sign-out', async () => {
    // Arrange: signed in, with cached data, a draft and an AI conversation.
    const { user, queryClient } = renderWithRouter({ routes, path: '/', session: makeSession() })
    await screen.findByText('status: signedIn')
    queryClient.setQueryData(['notes'], ['cached note'])
    window.localStorage.setItem(storageKey('draft', 'class-1'), 'draft text')
    window.sessionStorage.setItem(storageKey('ai', 'conversation'), '[]')

    // Act.
    await user.click(screen.getByRole('button', { name: 'sign out' }))

    // Assert: signed out...
    expect(await screen.findByText('status: signedOut')).toBeInTheDocument()
    // ...cache emptied...
    await waitFor(() => {
      expect(queryClient.getQueryData(['notes'])).toBeUndefined()
    })
    // ...draft and conversation gone.
    expect(window.localStorage.getItem(storageKey('draft', 'class-1'))).toBeNull()
    expect(window.sessionStorage.getItem(storageKey('ai', 'conversation'))).toBeNull()
  })

  // SECURITY: proves sign-out also deletes cached responses that may hold student data
  // (FR-PWA-7), while keeping the app shell so the app still opens offline.
  it('deletes runtime caches on sign-out and keeps the app shell', async () => {
    // Arrange: a fake Cache API holding the app shell and a runtime cache.
    const deleteCache = vi.fn(() => Promise.resolve(true))
    vi.stubGlobal('caches', {
      keys: () => Promise.resolve(['workbox-precache-v2-/', 'conote-runtime-notes']),
      delete: deleteCache,
    })
    const { user } = renderWithRouter({ routes, path: '/', session: makeSession() })
    await screen.findByText('status: signedIn')

    // Act.
    await user.click(screen.getByRole('button', { name: 'sign out' }))

    // Assert: only the runtime cache was deleted.
    await waitFor(() => {
      expect(deleteCache).toHaveBeenCalledWith('conote-runtime-notes')
    })
    expect(deleteCache).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  // Proves a broken Cache API is reported but doesn't stop sign-out.
  it('still signs out when the caches cannot be cleared', async () => {
    // Arrange: a Cache API that fails.
    vi.stubGlobal('caches', {
      keys: () => Promise.reject(new Error('blocked')),
      delete: vi.fn(),
    })
    const { user } = renderWithRouter({ routes, path: '/', session: makeSession() })
    await screen.findByText('status: signedIn')

    // Act.
    await user.click(screen.getByRole('button', { name: 'sign out' }))

    // Assert: signed out, and the failure was reported.
    expect(await screen.findByText('status: signedOut')).toBeInTheDocument()
    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        where: 'AuthProvider.clearRuntimeCaches',
      })
    })
    vi.unstubAllGlobals()
  })

  // Proves demo data (the stand-in server) survives sign-out.
  it('keeps mock demo data on sign-out', async () => {
    // Arrange: signed in, with demo data stored.
    const { user } = renderWithRouter({ routes, path: '/', session: makeSession() })
    await screen.findByText('status: signedIn')
    window.localStorage.setItem(storageKey('mock', 'notes'), '[]')

    // Act.
    await user.click(screen.getByRole('button', { name: 'sign out' }))

    // Assert: still there.
    await screen.findByText('status: signedOut')
    expect(window.localStorage.getItem(storageKey('mock', 'notes'))).toBe('[]')
  })
})

describe('AuthProvider when sign-out fails', () => {
  /** Test services whose sign-out always fails, as it would with no connection. */
  function failingAuth() {
    // Start from the normal demo service.
    const { auth } = createTestServices()
    return {
      // Keep every other method.
      ...auth,
      // Replace sign-out with one that rejects.
      signOut: () => Promise.reject(new AppError('network', 'offline')),
    }
  }

  // Proves a failed sign-out is reported, not left as an unhandled error (Copilot finding).
  it('reports the failure instead of leaving an unhandled rejection', async () => {
    // Arrange: signed in, with the failing service.
    const { user } = renderWithRouter({
      routes,
      path: '/',
      session: makeSession(),
      services: { auth: failingAuth() },
    })
    await screen.findByText('status: signedIn')

    // Act.
    await user.click(screen.getByRole('button', { name: 'sign out' }))

    // Assert: reported with where it happened.
    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(expect.any(AppError), {
        where: 'AuthProvider.signOut',
      })
    })
  })

  // SECURITY: proves local data is cleared even when the server call fails.
  it('still clears data stored on this device', async () => {
    // Arrange: signed in, failing service, a stored draft.
    const { user } = renderWithRouter({
      routes,
      path: '/',
      session: makeSession(),
      services: { auth: failingAuth() },
    })
    await screen.findByText('status: signedIn')
    window.localStorage.setItem(storageKey('draft', 'class-1'), 'draft text')

    // Act.
    await user.click(screen.getByRole('button', { name: 'sign out' }))

    // Assert: the draft is gone anyway.
    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey('draft', 'class-1'))).toBeNull()
    })
  })
})
