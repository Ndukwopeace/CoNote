/**
 * Types for signing in to the admin console and for the signed-in session.
 */

// The shared role names (packages/domain).
import type { Role } from '@conote/domain'

/** The signed-in person, as the console sees them. Any role can sign in; only admins get in. */
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

/** What the sign-in form sends. */
export interface SignInInput {
  email: string
  password: string
}
