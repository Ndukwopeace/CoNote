/**
 * The storage Supabase keeps its session in, with "Remember me" support. supabase-js writes the
 * session through whatever storage it is given; this one chooses between long-lived
 * (localStorage) and per-browser-session (sessionStorage) storage.
 */

/** What supabase-js needs from a storage object. */
export interface SessionStorageAdapter {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

/** The two storage areas, injected so tests can use their own. */
interface RememberStorageOptions {
  // Long-lived storage: survives closing the browser.
  local: Storage
  // Per-session storage: cleared when the browser closes.
  session: Storage
  // Where the "remember" choice is kept in the long-lived storage.
  flagKey: string
}

/** The adapter plus the switch the sign-in code flips. */
export interface RememberStorage {
  storage: SessionStorageAdapter
  // Records whether the next session should outlive the browser.
  setRemember: (remember: boolean) => void
}

/** Builds a storage adapter that keeps the session where the student asked for it to be kept. */
export function createRememberStorage({
  local,
  session,
  flagKey,
}: RememberStorageOptions): RememberStorage {
  const storage: SessionStorageAdapter = {
    getItem(key) {
      // Either place may hold the session; the per-session copy wins if both exist.
      return session.getItem(key) ?? local.getItem(key)
    },
    setItem(key, value) {
      // A refresh must follow the session it refreshes, wherever that lives now. Only a brand-new
      // session uses the recorded choice.
      const remembered = local.getItem(key) !== null || local.getItem(flagKey) === '1'
      const inSession = session.getItem(key) !== null
      const useLocal = inSession ? false : remembered
      // SECURITY: a session that was not remembered is never written to long-lived storage.
      const [target, other] = useLocal ? [local, session] : [session, local]
      target.setItem(key, value)
      // No copy is left behind in the other area.
      other.removeItem(key)
    },
    removeItem(key) {
      // SECURITY: sign-out clears the session wherever it was kept.
      local.removeItem(key)
      session.removeItem(key)
    },
  }
  return {
    storage,
    setRemember(remember) {
      // The marker holds no personal data, only the choice.
      if (remember) local.setItem(flagKey, '1')
      else local.removeItem(flagKey)
    },
  }
}
