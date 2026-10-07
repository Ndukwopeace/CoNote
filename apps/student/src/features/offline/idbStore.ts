/**
 * A tiny key-value store on IndexedDB, for the offline copy of the student's notes (FR-PWA-8).
 * Written here rather than added as a library: it needs get, set and delete (decision D45).
 */

/** The database's name; sign-out deletes it whole. */
export const OFFLINE_DB_NAME = 'conote-offline'
/** The one object store inside it. */
const STORE_NAME = 'cache'

/** What the persister needs from a store. */
export interface KeyValueStore {
  // The value under `key`, or undefined.
  get(key: string): Promise<unknown>
  // Saves `value` under `key`.
  set(key: string, value: unknown): Promise<void>
  // Removes `key`.
  del(key: string): Promise<void>
}

/** Turns an IndexedDB request into a promise. */
function done<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'))
    }
  })
}

/** Opens the database, creating the store the first time. */
function open(factory: IDBFactory) {
  // Version 1: one store.
  const request = factory.open(OFFLINE_DB_NAME, 1)
  // First open on this device: create the store.
  request.onupgradeneeded = () => {
    request.result.createObjectStore(STORE_NAME)
  }
  return done(request)
}

/**
 * Runs one operation in its own transaction and closes the database afterwards. Closing matters:
 * an open connection would block sign-out from deleting the database.
 */
async function withStore<T>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open(factory)
  try {
    return await done(run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)))
  } finally {
    db.close()
  }
}

/** The store, or one that keeps nothing where IndexedDB is missing (old browsers, some private modes, jsdom). */
export function createIdbStore(): KeyValueStore {
  // Read at call time, so tests can stub it.
  const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB
  if (!factory) {
    return {
      get: () => Promise.resolve(undefined),
      set: () => Promise.resolve(),
      del: () => Promise.resolve(),
    }
  }
  return {
    get: (key) => withStore<unknown>(factory, 'readonly', (store) => store.get(key)),
    set: async (key, value) => {
      await withStore(factory, 'readwrite', (store) => store.put(value, key))
    },
    del: async (key) => {
      await withStore(factory, 'readwrite', (store) => store.delete(key))
    },
  }
}
