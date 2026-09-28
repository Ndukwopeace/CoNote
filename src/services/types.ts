/**
 * Service interfaces (REQUIREMENTS.md section 12.1). UI code depends on these, never on an
 * implementation. More services join the registry as the milestones that need them land.
 */

// The auth data shapes the interface methods accept and return.
import type { OAuthProvider, Session, SignInInput, SignUpInput } from '@/types/auth'

/** Everything the app can ask of an authentication backend (mock today, Supabase later). */
export interface AuthService {
  /** The current session, or null when nobody is signed in. */
  getSession(): Promise<Session | null>
  /** Signs in with email and password; rejects with a validation AppError on bad input. */
  signIn(input: SignInInput): Promise<Session>
  /** Creates a student account and signs it in. */
  signUp(input: SignUpInput): Promise<Session>
  /** Signs in through Google or Microsoft. */
  signInWithProvider(provider: OAuthProvider): Promise<Session>
  /** Ends the session. */
  signOut(): Promise<void>
  /** Sends a reset link. Must resolve the same way whether or not the account exists. */
  requestPasswordReset(email: string): Promise<void>
  /** Sets a new password for the signed-in (or recovering) user. */
  updatePassword(newPassword: string): Promise<void>
  /** Calls `listener` whenever the session changes. Returns an unsubscribe function. */
  onAuthChange(listener: (session: Session | null) => void): () => void
}

/** The full set of services the app receives through ServicesProvider. */
export interface Services {
  // Authentication. Courses, notes and the rest join here in later milestones.
  auth: AuthService
}
