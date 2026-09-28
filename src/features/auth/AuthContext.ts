/**
 * The shape of the sign-in state shared across the app, and the context that carries it.
 */

// React's context factory.
import { createContext } from 'react'

// Auth data shapes used by the actions below.
import type {
  OAuthProvider,
  PasswordResetRequest,
  Session,
  SignInInput,
  SignUpInput,
} from '@/types/auth'

/** Where sign-in stands. Exactly one of three states, so screens can't mix them up. */
export type AuthState =
  // Still checking storage or the server; guards show a spinner.
  | { status: 'loading'; session: null }
  // Nobody is signed in.
  | {
      status: 'signedOut'
      session: null
      /**
       * Where to send the student after they chose to sign out. Null when the session simply
       * isn't there (never signed in, or expired), in which case guards send them to sign in.
       */
      exitTo: string | null
    }
  // Someone is signed in; the session says who.
  | { status: 'signedIn'; session: Session }

/** Everything useAuth() returns: the current state plus the actions. */
export type AuthContextValue = AuthState & {
  // Sign in with email and password.
  signIn: (input: SignInInput) => Promise<Session>
  // Create an account.
  signUp: (input: SignUpInput) => Promise<Session>
  // Sign in with Google or Microsoft.
  signInWithProvider: (provider: OAuthProvider) => Promise<Session>
  // Send a password reset link; the demo also returns the link (FR-AUTH-7).
  requestPasswordReset: (email: string) => Promise<PasswordResetRequest>
  // Set a new password from a reset link; the code is checked again (FR-AUTH-5).
  resetPassword: (code: string, newPassword: string) => Promise<void>
  // Set a new password while signed in.
  updatePassword: (newPassword: string) => Promise<void>
  /**
   * Signs out, clears everything stored for this student (REQUIREMENTS.md NFR-4) and sends
   * them to the landing page. Callers must not navigate themselves: the guards do it, so
   * two redirects never race. Never rejects: a failure is reported, and local data is still
   * cleared.
   */
  signOut: () => Promise<void>
  /** Called once the post-sign-out page has rendered, so later visits behave normally. */
  acknowledgeSignOut: () => void
}

// Starts as null; useAuth() turns a missing provider into a clear error.
export const AuthContext = createContext<AuthContextValue | null>(null)
