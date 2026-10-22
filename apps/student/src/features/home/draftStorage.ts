/**
 * The browser storage drafts are kept in, with a harmless stand-in where storage is blocked.
 */

// The storage shape drafts need.
import type { DraftStore } from '@/lib/noteDrafts'

/** A store that keeps nothing, for browsers that refuse storage altogether. */
const NO_STORAGE: DraftStore = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

/** localStorage, or the stand-in when merely touching it throws (some private modes do). */
export function draftStorage(): DraftStore {
  try {
    // Reading the property is what throws in those browsers.
    return window.localStorage
  } catch {
    // No drafts, but the editor still works.
    return NO_STORAGE
  }
}
