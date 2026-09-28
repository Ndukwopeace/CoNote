/**
 * Service interfaces (REQUIREMENTS.md section 12.1). UI code depends on these, never on an
 * implementation. More services join the registry as the milestones that need them land.
 */

// The auth data shapes the interface methods accept and return.
import type {
  OAuthProvider,
  PasswordResetRequest,
  Session,
  SignInInput,
  SignUpInput,
} from '@/types/auth'

/** Everything the app can ask of an authentication backend (mock today, Supabase later). */
export interface AuthService {
  /** The current session, or null when nobody is signed in. */
  getSession(): Promise<Session | null>
  /** Signs in with email and password; rejects with a validation AppError on bad input. */
  signIn(input: SignInInput): Promise<Session>
  /** Creates a student account and signs it in. */
  signUp(input: SignUpInput): Promise<Session>
  /** Signs in through Google (decision D38). */
  signInWithProvider(provider: OAuthProvider): Promise<Session>
  /** Ends the session. */
  signOut(): Promise<void>
  /**
   * Sends a reset link. Must resolve the same way whether or not the account exists.
   * The demo also returns the link itself, because it sends no email.
   */
  requestPasswordReset(email: string): Promise<PasswordResetRequest>
  /**
   * True when `code` (from the reset link) is still valid. Used and superseded codes are
   * refused. A missing code is always refused.
   */
  checkResetLink(code: string | null): Promise<boolean>
  /**
   * Sets a new password from a reset link. The code is checked again here, not only when the
   * page opened, and is spent on success. Rejects with a validation error when the code is no
   * longer valid or the password breaks the rules.
   */
  resetPassword(code: string, newPassword: string): Promise<void>
  /** Changes the password of the signed-in student (Settings → Account, M5). */
  updatePassword(newPassword: string): Promise<void>
  /** Calls `listener` whenever the session changes. Returns an unsubscribe function. */
  onAuthChange(listener: (session: Session | null) => void): () => void
}

/** The full set of services the app receives through ServicesProvider. */
export interface Services {
  // Authentication. Courses, notes and the rest join here in later milestones.
  auth: AuthService
}
