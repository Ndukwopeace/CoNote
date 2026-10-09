/**
 * The teacher portal's keys in browser storage. All start with one prefix, so sign-out can remove
 * them without touching anything else stored for the same address.
 */

/** The prefix of every key the portal stores. */
export const TEACHER_STORAGE_PREFIX = 'conote-teacher:'

/** Removes every portal key from `store`. */
export function clearTeacherStorage(store: Storage) {
  // Collect first: removing while walking the keys would shift the indexes.
  const keys: string[] = []
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    if (key?.startsWith(TEACHER_STORAGE_PREFIX)) keys.push(key)
  }
  // Then remove them.
  for (const key of keys) store.removeItem(key)
}
