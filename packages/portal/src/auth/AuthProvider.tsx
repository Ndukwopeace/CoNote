/**
 * Tracks the session and offers sign-in and sign-out to a portal.
 */

// Query cache access, cleared on sign-out.
import { useQueryClient } from '@tanstack/react-query'
// React state and effects.
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// Error reporting.
import { reportError } from '@conote/core/reportError'

// The context and its types.
import { AuthContext, type AuthContextValue, type AuthState } from './AuthContext'
// Clearing the portal's stored keys.
import { clearPrefixedStorage } from './storage'
// Session shapes.
import type { AuthService, Session } from './types'

/** What the provider needs from its portal. */
interface AuthProviderProps {
  // The portal's auth service.
  auth: AuthService
  // The prefix of every key the portal stores, removed on sign-out.
  storagePrefix: string
  children: ReactNode
}

/** The state for a session, or for no session. */
function toState(session: Session | null): AuthState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut', session: null }
}

/** Provides the sign-in state. Starts as "loading" until the stored session has been checked. */
export function AuthProvider({ auth, storagePrefix, children }: Readonly<AuthProviderProps>) {
  // The query cache, emptied on sign-out.
  const queryClient = useQueryClient()
  // Current state; "loading" until getSession answers.
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })

  // Read the stored session once, and follow every change after that.
  useEffect(() => {
    // Ignore answers that arrive after unmounting.
    let active = true
    auth
      .getSession()
      .then((session) => {
        if (active) setState(toState(session))
      })
      .catch((error: unknown) => {
        // A broken session check means signed out, never a stuck spinner.
        reportError(error, { where: 'AuthProvider.getSession' })
        if (active) setState(toState(null))
      })
    // Sign-in and sign-out anywhere update the state here.
    const unsubscribe = auth.onAuthChange((session) => {
      setState(toState(session))
    })
    // Stop listening when unmounted.
    return () => {
      active = false
      unsubscribe()
    }
  }, [auth])

  // The value given to the portal; rebuilt only when the state or service changes.
  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: (input) => auth.signIn(input),
      requestPasswordReset: (email) => auth.requestPasswordReset(email),
      checkResetLink: (code) => auth.checkResetLink(code),
      resetPassword: (code, newPassword) => auth.resetPassword(code, newPassword),
      signOut: async () => {
        try {
          await auth.signOut()
        } catch (error) {
          // Signing out must always work locally, even if the server call fails.
          reportError(error, { where: 'AuthProvider.signOut' })
        } finally {
          // SECURITY: forget everything the previous user loaded, so the next person at this
          // computer can't see it (shared-computer data exposure).
          queryClient.clear()
          clearPrefixedStorage(window.sessionStorage, storagePrefix)
          clearPrefixedStorage(window.localStorage, storagePrefix)
          // The service may already have announced the sign-out; make sure the state says so.
          setState(toState(null))
        }
      },
    }),
    [state, auth, queryClient, storagePrefix],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
