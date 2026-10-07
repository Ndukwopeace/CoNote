/**
 * Types for signing in and the signed-in session.
 */

// Shared ID and role types.
import type { Role } from './domain'

/** The signed-in person, as the app sees them. */
export interface SessionUser {
  // Unique account ID.
  id: string
  // student, teacher or admin. Only students may use this portal.
  role: Role
  // Shown in the sidebar, menu and greeting.
  fullName: string
  // Shown in the account menu.
  email: string
  // Optional profile picture address.
  avatarUrl?: string
}

/** A signed-in session. Wraps the user so tokens can be added later without breaking callers. */
export interface Session {
  // Who is signed in.
  user: SessionUser
}

/** The sign-in providers offered: Google only (decision D38, which replaced D3). */
export type OAuthProvider = 'google'

/** What the sign-in form sends. */
export interface SignInInput {
  // The typed email.
  email: string
  // The typed password.
  password: string
  // Whether the session should survive closing the browser.
  remember: boolean
}

/** What the sign-up form sends. */
export interface SignUpInput {
  // The student's full name.
  fullName: string
  // Their email.
  email: string
  // Their chosen password.
  password: string
}

/** What a password reset request returns. */
export interface PasswordResetRequest {
  /**
   * Demo mode only (FR-AUTH-7): the link the email would have contained, because no email is
   * sent. Real services leave it out, so the UI shows the shortcut only when it exists.
   */
  demoResetPath?: string
}
