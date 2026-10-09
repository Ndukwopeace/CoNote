/**
 * Opens the "Join your courses" dialog once per browser session for a student who has nothing
 * yet (FR-ENR-1), and remembers a skip so it doesn't come back on every page.
 */

// Local state.
import { useState } from 'react'

// Key builder.
import { storageKey } from '@/lib/storage'

/** Where a skip is remembered. Under the app's prefix, so sign-out forgets it. */
const SKIPPED_KEY = storageKey('join-dialog-skipped')

/** Whether the student already skipped the dialog in this browser session. */
function wasSkipped(): boolean {
  try {
    return window.sessionStorage.getItem(SKIPPED_KEY) !== null
  } catch {
    // Storage blocked: behave as if nothing was skipped.
    return false
  }
}

/** Remembers a skip for this browser session. */
function rememberSkip() {
  try {
    window.sessionStorage.setItem(SKIPPED_KEY, '1')
  } catch {
    // Storage blocked: the dialog may reopen on the next page, which is harmless.
  }
}

/**
 * The dialog's open state. It opens by itself when `offer` is true and the student hasn't skipped
 * it, and then stays open until it is closed, even once `offer` turns false (the student's first
 * request ends the "no requests" condition that offered it). Closing it, by any route, counts as
 * a skip. `open` opens it again on request.
 */
export function useJoinPrompt(offer: boolean) {
  // Whether the student skipped it earlier in this browser session.
  const [skipped, setSkipped] = useState(wasSkipped)
  // Whether the student asked for it with a "Find courses" button.
  const [requested, setRequested] = useState(false)
  // Whether it has been offered and not yet closed.
  const [offered, setOffered] = useState(false)
  // Latch the offer. Setting state while rendering, guarded by the condition, is React's way to
  // derive state from props; it runs once and the extra render settles at once.
  if (offer && !skipped && !offered) setOffered(true)

  return {
    // Showing: on request, or offered and not closed since.
    isOpen: requested || offered,
    // Opens it on request, from a "Find courses" button.
    open: () => {
      setRequested(true)
    },
    // Radix calls this on every open and close; a close is remembered as a skip.
    onOpenChange: (next: boolean) => {
      if (next) return
      setRequested(false)
      setOffered(false)
      setSkipped(true)
      rememberSkip()
    },
  }
}
