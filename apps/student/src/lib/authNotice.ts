/**
 * One-off notices shown on the sign-in page after another page sends the student there, such as
 * "Your password has been updated" after a reset (FR-AUTH-5). The notice travels in the
 * router's navigation state as a key, never as text.
 */

// The shared notice helpers (packages/core).
import { createNavigationNotices } from '@conote/core/navigationNotice'

/** Every notice the sign-in page can show, by key. */
const notices = createNavigationNotices({
  passwordUpdated: 'Your password has been updated. Sign in with your new password.',
})

/** The name of one notice. */
export type AuthNoticeKey = Parameters<typeof notices.stateFor>[0]

/** Builds the navigation state that asks the sign-in page to show `key`. */
export const authNoticeState = notices.stateFor

/**
 * The message for the notice carried in `state`, or null when there is none.
 * SECURITY: only known keys are accepted, so injected navigation state can't put text on screen.
 */
export const readAuthNotice = notices.read
