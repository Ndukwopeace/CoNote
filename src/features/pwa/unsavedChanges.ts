/**
 * A shared "a note has unsaved changes" flag (FR-PWA-5). The update toast reads it so an update
 * never reloads over unsaved writing. M4's note editor sets it; nothing sets it yet in M2.5.
 */

// Subscribes a component to a value that lives outside React.
import { useSyncExternalStore } from 'react'

// The current value. Module-level, because there is one editor at a time in the whole app.
let hasUnsavedChanges = false
// Components waiting to hear about changes.
const listeners = new Set<() => void>()

/** Records whether a note has unsaved changes, and tells every listener. */
export function setHasUnsavedChanges(value: boolean) {
  // Nothing changed: skip the re-renders.
  if (value === hasUnsavedChanges) return
  // Store the new value.
  hasUnsavedChanges = value
  // Notify each listener.
  for (const listener of listeners) listener()
}

/** Adds a listener and returns the function that removes it (the useSyncExternalStore shape). */
function subscribe(listener: () => void) {
  // Start notifying.
  listeners.add(listener)
  // Stop notifying when the component unmounts.
  return () => {
    listeners.delete(listener)
  }
}

/** The current value, read by React. */
function getSnapshot() {
  return hasUnsavedChanges
}

/** True while a note has unsaved changes. Re-renders when that changes. */
export function useHasUnsavedChanges() {
  // Same value on the server render, which this app doesn't use but React asks for.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
