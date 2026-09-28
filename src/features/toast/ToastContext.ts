/**
 * The toast context: the functions that show a toast. Kept apart from the provider component so
 * fast refresh works on both.
 */

// Creates the context.
import { createContext } from 'react'

/** What useToast() returns. */
export interface ToastApi {
  // A confirmation, e.g. "Note saved." Announced politely.
  success: (message: string) => void
  // A failure, e.g. "Couldn't delete the note." Announced at once.
  error: (message: string) => void
}

/** Null outside the provider; useToast() turns that into a clear error. */
export const ToastContext = createContext<ToastApi | null>(null)
