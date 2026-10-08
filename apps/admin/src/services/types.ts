/**
 * The admin app's service interfaces: everything the UI may ask of the backend. Pages reach them
 * only through useServices(), so the demo data and Supabase are interchangeable (D66).
 */

// Session shapes.
import type { PasswordResetRequest, Session, SignInInput } from '@/types/auth'

/** Signing in and out, and the current session. */
export interface AuthService {
  /** The stored session, or null when signed out. */
  getSession(): Promise<Session | null>
  /** Signs in; rejects with a validation AppError for wrong details, never saying which was wrong. */
  signIn(input: SignInInput): Promise<Session>
  /** Signs out and forgets the session. */
  signOut(): Promise<void>
  /**
   * Asks for a reset link for `email`. Resolves the same way whether or not an account exists;
   * rejects only for a malformed email.
   */
  requestPasswordReset(email: string): Promise<PasswordResetRequest>
  /** Whether `code` is the newest, unused reset code. */
  checkResetLink(code: string | null): Promise<boolean>
  /** Sets a new password with `code`, checking both again; the code then stops working. */
  resetPassword(code: string, newPassword: string): Promise<void>
  /** Calls `listener` whenever the session changes. Returns a function that stops listening. */
  onAuthChange(listener: (session: Session | null) => void): () => void
}

/** Every service the admin app uses. Grows with each milestone. */
export interface Services {
  auth: AuthService
}
