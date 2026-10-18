/**
 * Naming rules for everything CoNote keeps in the browser, and the sign-out clean-up.
 */

// Every key CoNote writes starts with this, so its data can be found and removed as a group.
export const STORAGE_PREFIX = 'conote:'

/** Mock demo data stands in for the server, so sign-out keeps it. */
export const MOCK_DATA_PREFIX = `${STORAGE_PREFIX}mock:`

/** The light/dark choice. It belongs to the device, not to the student, so sign-out keeps it. */
const KEPT_KEYS = new Set([`${STORAGE_PREFIX}theme`])

/** Builds a namespaced key: storageKey('draft', 'class-1') → "conote:draft:class-1". */
export function storageKey(...parts: string[]) {
  // Prefix plus the parts joined with colons.
  return `${STORAGE_PREFIX}${parts.join(':')}`
}

/**
 * Removes everything CoNote stored for the signed-in student (session, drafts, AI conversation)
 * so the next person on a shared computer sees none of it (REQUIREMENTS.md NFR-4).
 * SECURITY: blocks data left behind on shared or library computers.
 */
export function clearUserData(stores: Storage[]) {
  // Clean each store passed in (normally localStorage and sessionStorage).
  for (const store of stores) {
    // Collect the keys first. Removing while looping by index would skip keys, because the
    // indexes shift after every removal.
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index)).filter(
      (key): key is string =>
        // Keep only CoNote's own keys, and leave demo data (the stand-in server) in place.
        key !== null &&
        key.startsWith(STORAGE_PREFIX) &&
        !key.startsWith(MOCK_DATA_PREFIX) &&
        // The device's theme stays.
        !KEPT_KEYS.has(key),
    )
    // Delete every collected key.
    for (const key of keys) store.removeItem(key)
  }
}
