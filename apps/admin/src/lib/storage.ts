/**
 * The admin console's keys in browser storage. All start with one prefix, so sign-out can remove
 * them without touching anything else stored for the same address.
 */

/** The prefix of every key the console stores. */
export const ADMIN_STORAGE_PREFIX = 'conote-admin:'

/** Removes every console key from `store`. */
export function clearAdminStorage(store: Storage) {
  // Collect first: removing while walking the keys would shift the indexes.
  const keys: string[] = []
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    if (key?.startsWith(ADMIN_STORAGE_PREFIX)) keys.push(key)
  }
  // Then remove them.
  for (const key of keys) store.removeItem(key)
}
