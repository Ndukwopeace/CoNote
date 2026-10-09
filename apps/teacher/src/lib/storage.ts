/**
 * The teacher portal's keys in browser storage. All start with one prefix, so sign-out can remove
 * them without touching anything else stored for the same address (the removal itself is
 * `AuthProvider`'s, in packages/portal).
 */

/** The prefix of every key the portal stores. */
export const TEACHER_STORAGE_PREFIX = 'conote-teacher:'
