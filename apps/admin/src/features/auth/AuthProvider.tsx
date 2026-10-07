/**
 * Tracks the session and offers sign-in and sign-out to the console.
 */

// Query cache access, cleared on sign-out.
import { useQueryClient } from '@tanstack/react-query'
// React state and effects.
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// Error reporting.
import { reportError } from '@conote/core/reportError'

// Admin storage prefix.
import { clearAdminStorage } from '@/lib/storage'
// The services.
import { useServices } from '@/services/useServices'
// Session shape.
import type { Session } from '@/types/auth'

// The context and its types.
import { AuthContext, type AuthContextValue, type AuthState } from './AuthContext'

/** The state for a session, or for no session. */
function toState(session: Session | null): AuthState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut', session: null }
}

/** Provides the sign-in state. Starts as "loading" until the stored session has been checked. */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  // The auth service.
  const { auth } = useServices()
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

  // The value given to the console; rebuilt only when the state or service changes.
  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: (input) => auth.signIn(input),
      signOut: async () => {
        try {
          await auth.signOut()
        } catch (error) {
          // Signing out must always work locally, even if the server call fails.
          reportError(error, { where: 'AuthProvider.signOut' })
        } finally {
          // SECURITY: forget everything the previous administrator loaded, so the next person
          // at this computer can't see it (shared-computer data exposure).
          queryClient.clear()
          clearAdminStorage(window.sessionStorage)
          clearAdminStorage(window.localStorage)
          // The service may already have announced the sign-out; make sure the state says so.
          setState(toState(null))
        }
      },
    }),
    [state, auth, queryClient],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
