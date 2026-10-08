/**
 * One-off notices shown on a page after another page sends the user there, such as "Your password
 * has been updated" on sign-in after a reset. The notice travels in the router's navigation state
 * as a key, never as text (D68).
 */

/** The navigation state that carries a notice. */
interface NoticeState<Key extends string> {
  notice: Key
}

/**
 * Builds the helpers for one app's notices: `stateFor(key)` makes the navigation state, and
 * `read(state)` turns it back into the message, or null.
 */
export function createNavigationNotices<const Notices extends Record<string, string>>(
  notices: Notices,
) {
  /** The name of one notice. */
  type Key = Extract<keyof Notices, string>

  // Arrow functions, so callers can pass them around without losing `this`.
  return {
    /** The navigation state that asks the next page to show `key`. */
    stateFor: (key: Key): NoticeState<Key> => ({ notice: key }),

    /**
     * The message for the notice carried in `state`, or null when there is none.
     * SECURITY: blocks content injection. Navigation state can be written by any script on the
     * page, so only known keys are accepted and only their fixed wording is ever shown.
     */
    read: (state: unknown): string | null => {
      // Not an object: no notice.
      if (typeof state !== 'object' || state === null) return null
      // The key it carries, if any.
      const key = (state as { notice?: unknown }).notice
      // Only this app's own keys; Object.hasOwn rejects inherited names such as "toString".
      if (typeof key !== 'string' || !Object.hasOwn(notices, key)) return null
      // The fixed wording for that key.
      return notices[key as Key] ?? null
    },
  }
}
