/**
 * The sign-in state shared with the whole console.
 */

// Context factory.
import { createContext } from 'react'

// Session shapes.
import type { Session, SignInInput } from '@/types/auth'

/** Where sign-in stands: still checking, signed out, or signed in with a session. */
export type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'signedOut'; session: null }
  | { status: 'signedIn'; session: Session }

/** The state plus the actions that change it. */
export type AuthContextValue = AuthState & {
  signIn: (input: SignInInput) => Promise<Session>
  /** Never rejects; the route guard decides where to go next. */
  signOut: () => Promise<void>
}

/** The auth context, or null outside AuthProvider (useAuth turns that into an error). */
export const AuthContext = createContext<AuthContextValue | null>(null)
