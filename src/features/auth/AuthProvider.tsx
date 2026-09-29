/**
 * Holds the sign-in state for the whole app. It asks the auth service who is signed in,
 * listens for changes, and does the full clean-up on sign-out.
 */

// Access to the TanStack Query cache, which is cleared on sign-out.
import { useQueryClient } from '@tanstack/react-query'
// React hooks used below, and the children type.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// Deletes the offline copy of the student's notes.
import { clearOfflineData } from '@/features/offline/clearOfflineData'
// Deletes cached responses that may hold student data (FR-PWA-7).
import { clearRuntimeCaches } from '@/lib/pwa'
// Reports failures without exposing them to the student.
import { reportError } from '@/lib/reportError'
// Route constants; the landing page is the sign-out destination.
import { ROUTES } from '@/lib/routes'
// Removes CoNote's stored data from the browser.
import { clearUserData } from '@/lib/storage'
// Reaches the injected auth service.
import { useServices } from '@/services/useServices'
// The session type.
import type { Session } from '@/types/auth'

// The context this provider fills, and its types.
import { AuthContext, type AuthContextValue, type AuthState } from './AuthContext'

/** Turns a session (or null) into the matching AuthState. */
function toState(session: Session | null, exitTo: string | null = null): AuthState {
  // A session means signed in; no session means signed out, with an optional destination.
  return session ? { status: 'signedIn', session } : { status: 'signedOut', session: null, exitTo }
}

/** Provides sign-in state and actions to everything inside it. */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  // The injected auth service (mock or, later, Supabase).
  const { auth } = useServices()
  // The query cache, so sign-out can empty it.
  const queryClient = useQueryClient()
  // Starts as "loading" until the stored session has been checked.
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })
  /** Set during a deliberate sign-out so the resulting signed-out state carries a destination. */
  const pendingExit = useRef<string | null>(null)

  // Runs once per auth service: load the current session and subscribe to changes.
  useEffect(() => {
    // Guards against updating state after unmount, if the lookup finishes late.
    let active = true
    // Ask who is signed in right now.
    auth
      .getSession()
      .then((session) => {
        // Record the answer, if still mounted.
        if (active) setState(toState(session))
      })
      .catch((error: unknown) => {
        // Report the failure for developers.
        reportError(error, { where: 'AuthProvider.getSession' })
        // SECURITY: if the session can't be checked, treat the visitor as signed out (fail
        // closed) rather than letting them into student pages.
        if (active) setState(toState(null))
      })
    // Follow later changes (sign-in, sign-out). A pending exit rides along with a sign-out.
    const unsubscribe = auth.onAuthChange((session) => {
      setState(toState(session, pendingExit.current))
    })
    // Clean-up when unmounted or the service changes: ignore late answers and stop listening.
    return () => {
      active = false
      unsubscribe()
    }
  }, [auth])

  // The value handed to the context. Rebuilt only when its inputs change, to avoid re-renders.
  const value = useMemo<AuthContextValue>(
    () => ({
      // Current status and session.
      ...state,
      // Actions pass straight through to the service. State updates arrive via onAuthChange.
      signIn: (input) => auth.signIn(input),
      signUp: (input) => auth.signUp(input),
      signInWithProvider: (provider) => auth.signInWithProvider(provider),
      requestPasswordReset: (email) => auth.requestPasswordReset(email),
      resetPassword: (code, newPassword) => auth.resetPassword(code, newPassword),
      updatePassword: (currentPassword, newPassword) =>
        auth.updatePassword(currentPassword, newPassword),
      signOut: async () => {
        // Mark this as a chosen sign-out, so the guard sends the student to the landing page.
        pendingExit.current = ROUTES.landing
        try {
          // End the session with the service.
          await auth.signOut()
        } catch (error) {
          // Report failures instead of throwing, so no caller is left with an unhandled error.
          reportError(error, { where: 'AuthProvider.signOut' })
        } finally {
          // Later signed-out states are ordinary (they go to sign in), so reset the marker.
          pendingExit.current = null
          // SECURITY: empty the query cache so the next person on this computer can't see the
          // previous student's courses or notes, even through the Back button.
          queryClient.clear()
          // SECURITY: remove drafts, the AI conversation and session keys from browser storage.
          // This runs even when the service call failed.
          clearUserData([window.localStorage, window.sessionStorage])
          // SECURITY: delete the service worker's runtime caches, which may hold notes or
          // summaries (FR-PWA-7), so the next person can't read them offline. The app shell
          // cache holds no student data and stays. Browsers without the Cache API skip this.
          await clearRuntimeCaches('caches' in globalThis ? globalThis.caches : undefined).catch(
            (error: unknown) => {
              // Reported, never thrown: sign-out must still finish.
              reportError(error, { where: 'AuthProvider.clearRuntimeCaches' })
            },
          )
          // SECURITY: delete the offline copy of the student's notes in IndexedDB (FR-PWA-8),
          // so the next person on this computer can't read them offline. Always resolves.
          await clearOfflineData()
        }
      },
      acknowledgeSignOut: () => {
        // Clear the sign-out destination once used, so a later visit to a portal page goes to
        // sign in (flow F10). Leave the state untouched in every other case.
        setState((current) =>
          current.status === 'signedOut' && current.exitTo !== null
            ? { ...current, exitTo: null }
            : current,
        )
      },
    }),
    [state, auth, queryClient],
  )

  // Make the value available to everything inside.
  return <AuthContext value={value}>{children}</AuthContext>
}
