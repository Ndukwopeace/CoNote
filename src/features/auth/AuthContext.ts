import { createContext } from 'react'

import type { OAuthProvider, Session, SignInInput, SignUpInput } from '@/types/auth'

export type AuthState =
  | { status: 'loading'; session: null }
  | {
      status: 'signedOut'
      session: null
      /**
       * Where to send the student after they chose to sign out. Null when the session simply
       * isn't there (never signed in, or expired), in which case guards send them to sign in.
       */
      exitTo: string | null
    }
  | { status: 'signedIn'; session: Session }

export type AuthContextValue = AuthState & {
  signIn: (input: SignInInput) => Promise<Session>
  signUp: (input: SignUpInput) => Promise<Session>
  signInWithProvider: (provider: OAuthProvider) => Promise<Session>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  /**
   * Signs out, clears everything stored for this student (REQUIREMENTS.md NFR-4) and sends
   * them to the landing page. Callers must not navigate themselves: the guards do it, so
   * two redirects never race.
   */
  signOut: () => Promise<void>
  /** Called once the post-sign-out page has rendered, so later visits behave normally. */
  acknowledgeSignOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
