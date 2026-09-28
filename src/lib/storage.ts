export const STORAGE_PREFIX = 'conote:'

/** Mock demo data stands in for the server, so sign-out keeps it. */
export const MOCK_DATA_PREFIX = `${STORAGE_PREFIX}mock:`

export function storageKey(...parts: string[]) {
  return `${STORAGE_PREFIX}${parts.join(':')}`
}

/**
 * Removes everything CoNote stored for the signed-in student (session, drafts, AI conversation)
 * so the next person on a shared computer sees none of it (REQUIREMENTS.md NFR-4).
 */
export function clearUserData(stores: Storage[]) {
  for (const store of stores) {
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index)).filter(
      (key): key is string =>
        key !== null && key.startsWith(STORAGE_PREFIX) && !key.startsWith(MOCK_DATA_PREFIX),
    )
    for (const key of keys) store.removeItem(key)
  }
}
