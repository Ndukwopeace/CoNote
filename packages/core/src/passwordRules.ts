/**
 * The rules for choosing a new password, shared by every CoNote app (D68). Each app sets its own
 * minimum length; administrators need a longer one than students.
 */

// Schema builder.
import { z } from 'zod'

/**
 * A new password: at least `minLength` characters, with a letter and a number.
 * SECURITY: a length floor plus mixed characters makes guessing and dictionary attacks slower.
 * Services check it again, so skipping the form does not skip the rule.
 */
export function createNewPasswordSchema(minLength: number) {
  return (
    z
      .string()
      // Empty gets its own message.
      .min(1, 'Enter a password.')
      // Long enough.
      .min(minLength, `Use at least ${String(minLength)} characters.`)
      // A letter from any alphabet (\p{L}), not only a to z.
      .regex(/\p{L}/u, 'Include at least one letter.')
      // A digit.
      .regex(/\d/, 'Include at least one number.')
  )
}
