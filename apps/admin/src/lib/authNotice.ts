/**
 * One-off notices shown on the sign-in page after another page sends the administrator there,
 * such as "Your password has been updated" after a reset. They travel in navigation state as a
 * key, never as text (packages/core, D68).
 */

// The shared notice helpers.
import { createNavigationNotices } from '@conote/core/navigationNotice'

/** Every notice the sign-in page can show, by key. */
const notices = createNavigationNotices({
  passwordUpdated: 'Your password has been updated. Sign in with your new password.',
})

/** Builds the navigation state that asks the sign-in page to show a notice. */
export const authNoticeState = notices.stateFor

/**
 * The message for the notice in `state`, or null.
 * SECURITY: only known keys are accepted, so injected navigation state can't put text on screen.
 */
export const readAuthNotice = notices.read
