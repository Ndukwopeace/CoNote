/**
 * Deletes the offline copy of the student's data at sign-out (FR-PWA-7).
 */

// The database's name.
import { OFFLINE_DB_NAME } from './idbStore'

/**
 * Deletes the whole offline database. Resolves either way, so sign-out always finishes.
 * SECURITY: the next person on a shared computer can't read the previous student's notes offline.
 */
export function clearOfflineData(): Promise<void> {
  // Read at call time, so tests can stub it.
  const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB
  // No IndexedDB: nothing was ever stored.
  if (!factory) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const request = factory.deleteDatabase(OFFLINE_DB_NAME)
    // Deleted, failed or held open elsewhere: sign-out carries on in every case.
    request.onsuccess = () => {
      resolve()
    }
    request.onerror = () => {
      resolve()
    }
    request.onblocked = () => {
      resolve()
    }
  })
}
