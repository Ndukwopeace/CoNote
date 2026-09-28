import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppError } from '@/lib/errors'
import { reportError } from '@/lib/reportError'

import { storageKey } from '@/lib/storage'
import { makeSession } from '@/test/factories'
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'

import { useAuth } from './useAuth'

vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }))

function AuthProbe() {
  const { status, session, signIn, signOut } = useAuth()
  return (
    <div>
      <p>status: {status}</p>
      <p>user: {session?.user.fullName ?? 'none'}</p>
      <button
        type="button"
        onClick={() => void signIn({ email: 'v@example.com', password: 'x', remember: true })}
      >
        sign in
      </button>
      <button type="button" onClick={() => void signOut()}>
        sign out
      </button>
    </div>
  )
}

const routes = [{ path: '/', element: <AuthProbe /> }]

describe('AuthProvider', () => {
  it('reports signed out when there is no stored session', async () => {
    renderWithRouter({ routes, path: '/' })

    expect(await screen.findByText('status: signedOut')).toBeInTheDocument()
  })

  it('restores a stored session', async () => {
    renderWithRouter({ routes, path: '/', session: makeSession({ fullName: 'Ada Obi' }) })

    expect(await screen.findByText('user: Ada Obi')).toBeInTheDocument()
    expect(screen.getByText('status: signedIn')).toBeInTheDocument()
  })

  it('updates when the student signs in', async () => {
    const { user } = renderWithRouter({ routes, path: '/' })
    await screen.findByText('status: signedOut')

    await user.click(screen.getByRole('button', { name: 'sign in' }))

    expect(await screen.findByText('status: signedIn')).toBeInTheDocument()
  })

  it('clears the session, cached data, drafts and AI conversation on sign-out', async () => {
    const { user, queryClient } = renderWithRouter({ routes, path: '/', session: makeSession() })
    await screen.findByText('status: signedIn')
    queryClient.setQueryData(['notes'], ['cached note'])
    window.localStorage.setItem(storageKey('draft', 'class-1'), 'draft text')
    window.sessionStorage.setItem(storageKey('ai', 'conversation'), '[]')

    await user.click(screen.getByRole('button', { name: 'sign out' }))

    expect(await screen.findByText('status: signedOut')).toBeInTheDocument()
    await waitFor(() => {
      expect(queryClient.getQueryData(['notes'])).toBeUndefined()
    })
    expect(window.localStorage.getItem(storageKey('draft', 'class-1'))).toBeNull()
    expect(window.sessionStorage.getItem(storageKey('ai', 'conversation'))).toBeNull()
  })

  it('keeps mock demo data on sign-out', async () => {
    const { user } = renderWithRouter({ routes, path: '/', session: makeSession() })
    await screen.findByText('status: signedIn')
    window.localStorage.setItem(storageKey('mock', 'notes'), '[]')

    await user.click(screen.getByRole('button', { name: 'sign out' }))

    await screen.findByText('status: signedOut')
    expect(window.localStorage.getItem(storageKey('mock', 'notes'))).toBe('[]')
  })
})

describe('AuthProvider when sign-out fails', () => {
  function failingAuth() {
    const { auth } = createTestServices()
    return {
      ...auth,
      signOut: () => Promise.reject(new AppError('network', 'offline')),
    }
  }

  it('reports the failure instead of leaving an unhandled rejection', async () => {
    const { user } = renderWithRouter({
      routes,
      path: '/',
      session: makeSession(),
      services: { auth: failingAuth() },
    })
    await screen.findByText('status: signedIn')

    await user.click(screen.getByRole('button', { name: 'sign out' }))

    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(expect.any(AppError), {
        where: 'AuthProvider.signOut',
      })
    })
  })

  it('still clears data stored on this device', async () => {
    const { user } = renderWithRouter({
      routes,
      path: '/',
      session: makeSession(),
      services: { auth: failingAuth() },
    })
    await screen.findByText('status: signedIn')
    window.localStorage.setItem(storageKey('draft', 'class-1'), 'draft text')

    await user.click(screen.getByRole('button', { name: 'sign out' }))

    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey('draft', 'class-1'))).toBeNull()
    })
  })
})
