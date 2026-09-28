import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { reportError } from '@/lib/reportError'
import { ROUTES } from '@/lib/routes'
import { clearUserData } from '@/lib/storage'
import { useServices } from '@/services/useServices'
import type { Session } from '@/types/auth'

import { AuthContext, type AuthContextValue, type AuthState } from './AuthContext'

function toState(session: Session | null, exitTo: string | null = null): AuthState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut', session: null, exitTo }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useServices()
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })
  /** Set during a deliberate sign-out so the resulting signed-out state carries a destination. */
  const pendingExit = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    auth
      .getSession()
      .then((session) => {
        if (active) setState(toState(session))
      })
      .catch((error: unknown) => {
        reportError(error, { where: 'AuthProvider.getSession' })
        if (active) setState(toState(null))
      })
    const unsubscribe = auth.onAuthChange((session) => {
      setState(toState(session, pendingExit.current))
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [auth])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: (input) => auth.signIn(input),
      signUp: (input) => auth.signUp(input),
      signInWithProvider: (provider) => auth.signInWithProvider(provider),
      requestPasswordReset: (email) => auth.requestPasswordReset(email),
      updatePassword: (newPassword) => auth.updatePassword(newPassword),
      signOut: async () => {
        pendingExit.current = ROUTES.landing
        try {
          await auth.signOut()
        } finally {
          pendingExit.current = null
          queryClient.clear()
          clearUserData([window.localStorage, window.sessionStorage])
        }
      },
      acknowledgeSignOut: () => {
        setState((current) =>
          current.status === 'signedOut' && current.exitTo !== null
            ? { ...current, exitTo: null }
            : current,
        )
      },
    }),
    [state, auth, queryClient],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
