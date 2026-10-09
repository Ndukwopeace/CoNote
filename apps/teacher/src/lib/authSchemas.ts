/**
 * The rules for the portal's sign-in and password forms (ENGINEERING_STANDARDS.md 6.3). The
 * forms and the demo service share them, so the browser and the "server" can never disagree.
 */

// The shared new-password rules (packages/core).
import { createNewPasswordSchema } from '@conote/core/passwordRules'
// Schema builder.
import { z } from 'zod'

/**
 * Shortest password a teacher may choose (D68, D74). Longer than the students' 8, because a
 * teacher account can publish summaries to every student in a course. The same rule as the
 * admin app's, so all staff accounts follow one rule.
 */
export const TEACHER_MIN_PASSWORD_LENGTH = 12

/** An email: trimmed and lower-cased first, so " Teacher@Example.com " is accepted as typed. */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }))

/** Sign-in: a valid email and any non-empty password (the service checks the password). */
export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
})

/** The sign-in form's values after checking. */
export type SignInValues = z.infer<typeof signInSchema>

/** Forgot password: just the email. */
export const forgotPasswordSchema = z.object({ email: emailField })

/** The forgot-password form's values after checking. */
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

/**
 * A new teacher password: 12+ characters with a letter and a number.
 * SECURITY: checked again by the service, so skipping the form does not skip the rule.
 */
export const newTeacherPasswordSchema = createNewPasswordSchema(TEACHER_MIN_PASSWORD_LENGTH)

/** Reset password: the new password twice, and they must match. */
export const resetPasswordSchema = z
  .object({
    password: newTeacherPasswordSchema,
    confirmPassword: z.string().min(1, 'Enter the password again.'),
  })
  // The mismatch message belongs to the second field, where the mistake is.
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

/** The reset form's values after checking. */
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
