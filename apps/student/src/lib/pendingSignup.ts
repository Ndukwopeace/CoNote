/**
 * Remembers a sign-up that is waiting for its emailed code. A student leaves the app to read the
 * email, and a phone may reload the page on their return, so the code screen is brought back
 * from here instead of sending them to an empty form. Only the address is kept, never a password.
 */

// Zod checks what comes back out of storage.
import { z } from 'zod'

// Namespaced keys, so sign-out removes this with everything else CoNote stored.
import { storageKey } from './storage'

/** The key the address is kept under. */
const KEY = storageKey('pending-signup')

/** How long a remembered sign-up is shown again: a little under the code's hour. */
const KEEP_MINUTES = 55

// SECURITY: storage can be edited by anything running on the page, so what comes back is checked
// before it is trusted.
const storedSchema = z.object({ email: z.string().min(1), at: z.number() })

/** Remembers that a code was sent to `email` at `now`. Storage that refuses is ignored. */
export function rememberPendingSignup(email: string, now: Date): void {
  try {
    // The address and when the code was sent.
    window.localStorage.setItem(KEY, JSON.stringify({ email, at: now.getTime() }))
  } catch {
    // A private window may refuse; the code screen simply will not survive a reload.
  }
}

/** The address a code is waiting for, or null when there is none or it is too old. */
export function readPendingSignup(now: Date): string | null {
  try {
    // Nothing remembered.
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return null
    // Damaged text is not trusted.
    const stored = storedSchema.safeParse(JSON.parse(raw) as unknown)
    if (!stored.success) return null
    // Old: the code has expired, so the form is the right screen. Remove it.
    if (now.getTime() - stored.data.at > KEEP_MINUTES * 60_000) {
      window.localStorage.removeItem(KEY)
      return null
    }
    // Still good.
    return stored.data.email
  } catch {
    // Unreadable storage or text that is not JSON.
    return null
  }
}

/** Forgets the remembered sign-up (the code was used, or the student chose another address). */
export function clearPendingSignup(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing to do if storage refuses.
  }
}
