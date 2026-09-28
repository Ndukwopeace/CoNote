/**
 * Saves the query cache to a key-value store at most once per pause, for TanStack Query's
 * persistence (FR-PWA-8).
 */

// The persister contract.
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

// The store it writes to.
import type { KeyValueStore } from './idbStore'

/** How long after the last change the cache is written: one write per burst of changes. */
export const PERSIST_DELAY_MS = 1000

/** A persister that can also drop a write still waiting (used at sign-out). */
export type CancellablePersister = Persister & { cancel: () => void }

/** Builds the persister over `store`, keeping everything under `key`. */
export function createThrottledPersister(store: KeyValueStore, key: string): CancellablePersister {
  // The pending write.
  let timer: ReturnType<typeof setTimeout> | undefined
  // The latest cache to write.
  let latest: PersistedClient | undefined

  return {
    // Remember the latest cache; write it once changes pause.
    persistClient: (client) => {
      latest = client
      clearTimeout(timer)
      timer = setTimeout(() => {
        const toWrite = latest
        latest = undefined
        if (toWrite) void store.set(key, toWrite).catch(() => undefined)
      }, PERSIST_DELAY_MS)
    },
    // The saved cache; TanStack Query checks its age and owner (buster) before using it.
    restoreClient: async () => (await store.get(key)) as PersistedClient | undefined,
    // Forget the saved cache.
    removeClient: () => store.del(key),
    // Drop any write still waiting.
    cancel: () => {
      clearTimeout(timer)
      latest = undefined
    },
  }
}
