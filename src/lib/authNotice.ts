/**
 * One-off notices shown on the sign-in page after another page sends the student there, such as
 * "Your password has been updated" after a reset (FR-AUTH-5). The notice travels in the
 * router's navigation state as a key, never as text.
 */

/** Every notice the sign-in page can show, by key. */
const AUTH_NOTICES = {
  // After a successful password reset.
  passwordUpdated: 'Your password has been updated. Sign in with your new password.',
  // `as const` keeps the keys as exact types.
} as const

/** The name of one notice. */
export type AuthNoticeKey = keyof typeof AUTH_NOTICES

/** Builds the navigation state that asks the sign-in page to show `key`. */
export function authNoticeState(key: AuthNoticeKey) {
  // A plain object, so the router can store it in the browser history.
  return { notice: key }
}

/**
 * The message for the notice carried in `state`, or null when there is none.
 * SECURITY: blocks content injection. Navigation state can be written by any script on the
 * page, so only known keys are accepted and only their fixed wording is ever shown.
 */
export function readAuthNotice(state: unknown): string | null {
  // No state, or not an object: nothing to show.
  if (typeof state !== 'object' || state === null) return null
  // Read the notice field without trusting its type.
  const key = (state as { notice?: unknown }).notice
  // SECURITY: own keys only, so names inherited from Object (such as "toString") don't match.
  if (typeof key !== 'string' || !Object.hasOwn(AUTH_NOTICES, key)) return null
  // The fixed message for that key.
  return AUTH_NOTICES[key as AuthNoticeKey]
}
