/**
 * Clearing a portal's keys from browser storage. A portal's keys all start with one prefix, so
 * sign-out can remove them without touching anything else stored for the same address.
 */

/** Removes every key of `store` that starts with `prefix`. */
export function clearPrefixedStorage(store: Storage, prefix: string) {
  // Collect first: removing while walking the keys would shift the indexes.
  const keys: string[] = []
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    if (key?.startsWith(prefix)) keys.push(key)
  }
  // Then remove them.
  for (const key of keys) store.removeItem(key)
}
