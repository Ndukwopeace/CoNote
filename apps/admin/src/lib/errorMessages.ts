/**
 * Administrator-facing wording for each kind of error, kept in one place so every console screen
 * explains problems the same way. The wording is the staff portals' shared one (packages/portal),
 * with the "no access" line of someone who is already an administrator. The student app has its
 * own wording for students.
 */

// The shared wording, and how to give it a "no access" line of its own.
import { createErrorMessage } from '@conote/portal'

/** What happened and what to do next, for each error kind. */
export const errorMessage = createErrorMessage(
  "You don't have access to this. Ask another administrator if you need it.",
)
