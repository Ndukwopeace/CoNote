/**
 * The admin app's service interfaces: everything the UI may ask of the backend. Pages reach them
 * only through useServices(), so the demo data and Supabase are interchangeable (D66).
 */

// Session shapes.
import type { Session, SignInInput } from '@/types/auth'

/** Signing in and out, and the current session. */
export interface AuthService {
  /** The stored session, or null when signed out. */
  getSession(): Promise<Session | null>
  /** Signs in; rejects with a validation AppError for wrong details, never saying which was wrong. */
  signIn(input: SignInInput): Promise<Session>
  /** Signs out and forgets the session. */
  signOut(): Promise<void>
  /** Calls `listener` whenever the session changes. Returns a function that stops listening. */
  onAuthChange(listener: (session: Session | null) => void): () => void
}

/** Every service the admin app uses. Grows with each milestone. */
export interface Services {
  auth: AuthService
}
