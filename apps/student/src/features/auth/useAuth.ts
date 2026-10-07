/**
 * The hook components use to read the sign-in state and call sign-in actions.
 */

// React 19's `use` reads a context value.
import { use } from 'react'

// The context filled by AuthProvider.
import { AuthContext } from './AuthContext'

/** Returns the current auth state and actions. Throws if called outside AuthProvider. */
export function useAuth() {
  // Read the nearest AuthProvider's value.
  const auth = use(AuthContext)
  // A missing provider is a programming mistake; say how to fix it.
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  // Hand back state and actions.
  return auth
}
