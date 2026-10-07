/**
 * Reads the sign-in state.
 */

// Reads a context.
import { use } from 'react'

// The context.
import { AuthContext } from './AuthContext'

/** The sign-in state and actions. Fails loudly outside AuthProvider. */
export function useAuth() {
  const auth = use(AuthContext)
  // A missing provider is a wiring bug.
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}
