import type { OAuthProvider, Session, SignInInput, SignUpInput } from '@/types/auth'

/**
 * Service interfaces (REQUIREMENTS.md section 12.1). UI code depends on these, never on an
 * implementation. More services join the registry as the milestones that need them land.
 */

export interface AuthService {
  getSession(): Promise<Session | null>
  signIn(input: SignInInput): Promise<Session>
  signUp(input: SignUpInput): Promise<Session>
  signInWithProvider(provider: OAuthProvider): Promise<Session>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(newPassword: string): Promise<void>
  /** Calls `listener` whenever the session changes. Returns an unsubscribe function. */
  onAuthChange(listener: (session: Session | null) => void): () => void
}

export interface Services {
  auth: AuthService
}
