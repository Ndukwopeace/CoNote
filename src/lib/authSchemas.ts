/**
 * The rules for every sign-in, sign-up and password form (REQUIREMENTS.md FR-AUTH-3). The forms
 * and the demo auth service share these, so the browser and the "server" can never disagree.
 */

// zod describes each form's shape and rules, and gives the error messages.
import { z } from 'zod'

/** Longest full name accepted (FR-AUTH-3); long enough for real names, short enough for layouts. */
export const MAX_NAME_LENGTH = 80

/** Shortest password accepted for a new password (FR-AUTH-3). */
export const MIN_PASSWORD_LENGTH = 8

/**
 * An email address. Spaces around it are removed first, because they are easy to paste in by
 * accident and would otherwise fail the format check with a confusing message.
 */
const emailField = z
  // Must be text.
  .string()
  // Drop spaces at either end before checking.
  .trim()
  // Empty gets its own message, so "Enter…" and "Enter a valid…" are not confused.
  .min(1, 'Enter your email address.')
  // Then the format. `pipe` runs this only when the field is not empty.
  .pipe(z.email('Enter a valid email address.'))

/**
 * A new password: at least 8 characters with a letter and a number (FR-AUTH-3).
 * SECURITY: a length floor plus mixed characters makes guessing and dictionary attacks slower.
 * Checked again by the auth service, so skipping the form does not skip the rule.
 */
export const newPasswordSchema = z
  // Must be text. Not trimmed: spaces are allowed in passwords and count as characters.
  .string()
  // Empty gets a direct request rather than a length message.
  .min(1, 'Enter a password.')
  // The length rule.
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  // At least one letter, from any alphabet.
  .regex(/\p{L}/u, 'Include at least one letter.')
  // At least one digit.
  .regex(/\d/, 'Include at least one number.')

/** A full name: 2–80 characters after trimming (FR-AUTH-3). */
export const fullNameSchema = z
  // Must be text.
  .string()
  // Spaces at either end don't count towards the length and aren't saved.
  .trim()
  // Empty (or only spaces) gets a direct request.
  .min(1, 'Enter your full name.')
  // One letter is not a name.
  .min(2, 'Use at least 2 characters.')
  // Upper limit.
  .max(MAX_NAME_LENGTH, `Use ${MAX_NAME_LENGTH} characters or fewer.`)

/** Message for a confirmation that does not match, shared by sign-up and reset. */
const MISMATCH = 'Passwords do not match.'

/**
 * Runs the "passwords match" check whenever both fields are text, even if other fields still
 * have errors. zod otherwise skips object checks until every field is valid, which would hide
 * the mismatch message until the student had fixed everything else.
 */
function bothPasswordsPresent({ value }: { value: unknown }) {
  // Only an object can hold the two fields.
  if (typeof value !== 'object' || value === null) return false
  // Read the two fields without assuming their types.
  const { password, confirmPassword } = value as Record<string, unknown>
  // Compare only when both are text.
  return typeof password === 'string' && typeof confirmPassword === 'string'
}

/** Checks that the confirmation matches, reporting on the confirm field where the student looks. */
function passwordsMatch(fields: { password: string; confirmPassword: string }) {
  // Exact comparison; passwords are case- and space-sensitive.
  return fields.password === fields.confirmPassword
}

/** The sign-in form (FR-AUTH-1). */
export const signInSchema = z.object({
  // The account email.
  email: emailField,
  // Any non-empty password. The new-password rules are not applied here, because accounts
  // created before a rule change must still be able to sign in.
  password: z.string().min(1, 'Enter your password.'),
  // "Remember me".
  remember: z.boolean(),
})

/** The sign-up form (FR-AUTH-2). */
export const signUpSchema = z
  .object({
    // Shown in the portal.
    fullName: fullNameSchema,
    // The account email.
    email: emailField,
    // The new password, with the strength rules.
    password: newPasswordSchema,
    // Typed twice to catch typos; only compared, never sent.
    confirmPassword: z.string(),
    // The terms checkbox (FR-AUTH-2). Must be ticked.
    acceptTerms: z.boolean().refine((accepted) => accepted, {
      error: 'Accept the Terms of Service and Privacy Policy to continue.',
    }),
  })
  // The two passwords must match.
  .refine(passwordsMatch, {
    // Attach the message to the confirm field.
    path: ['confirmPassword'],
    error: MISMATCH,
    // Run even while other fields are invalid.
    when: bothPasswordsPresent,
  })

/** The forgot-password form (FR-AUTH-4). */
export const forgotPasswordSchema = z.object({
  // Where to send the reset link.
  email: emailField,
})

/** The reset-password form (FR-AUTH-5). */
export const resetPasswordSchema = z
  .object({
    // The new password, with the strength rules.
    password: newPasswordSchema,
    // Typed twice to catch typos.
    confirmPassword: z.string(),
  })
  // The two passwords must match.
  .refine(passwordsMatch, {
    // Attach the message to the confirm field.
    path: ['confirmPassword'],
    error: MISMATCH,
    // Run even while the password itself is invalid.
    when: bothPasswordsPresent,
  })

/** What the sign-in form holds while being filled in. */
export type SignInValues = z.input<typeof signInSchema>
/** What the sign-up form holds while being filled in. */
export type SignUpValues = z.input<typeof signUpSchema>
/** What the forgot-password form holds. */
export type ForgotPasswordValues = z.input<typeof forgotPasswordSchema>
/** What the reset-password form holds. */
export type ResetPasswordValues = z.input<typeof resetPasswordSchema>
