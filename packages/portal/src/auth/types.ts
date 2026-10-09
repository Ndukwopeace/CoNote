/**
 * Types for signing in to a staff portal (admin console, teacher portal) and for the signed-in
 * session. The services that implement them are each app's own (D66, D77).
 */

// The shared role names (packages/domain).
import type { Role } from '@conote/domain'

/** The signed-in person, as a portal sees them. Any role can sign in; only the portal's own gets in. */
export interface SessionUser {
  id: string
  role: Role
  fullName: string
  email: string
}

/** A signed-in session. Wraps the user so tokens can be added later without breaking callers. */
export interface Session {
  user: SessionUser
}

/** What a password reset request returns. */
export interface PasswordResetRequest {
  /**
   * Demo mode only: the link the email would have contained, because no email is sent. A real
   * service leaves it out, so the page shows the shortcut only when it exists.
   */
  demoResetPath?: string
}

/** What the sign-in form sends. */
export interface SignInInput {
  email: string
  password: string
}

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
