/**
 * The rules for the staff portals' sign-in and password forms (ENGINEERING_STANDARDS.md 6.3). The
 * forms and the demo service share them, so the browser and the "server" can never disagree.
 */

// The shared new-password rules (packages/core).
import { createNewPasswordSchema } from '@conote/core/passwordRules'
// Schema builder.
import { z } from 'zod'

/**
 * Shortest password a staff member (admin or teacher) may choose. It was 12 (D68, D74) and is 8
 * since D119, the same as the students', because teachers found 12 too long to type and a staff
 * password is also the fallback for the emailed sign-in code.
 */
export const STAFF_MIN_PASSWORD_LENGTH = 8

/** An email: trimmed and lower-cased first, so " Admin@Example.com " is accepted as typed. */
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
 * A new staff password: 8+ characters with a letter and a number.
 * SECURITY: checked again by the service, so skipping the form does not skip the rule.
 */
export const newStaffPasswordSchema = createNewPasswordSchema(STAFF_MIN_PASSWORD_LENGTH)

/** Reset password: the new password twice, and they must match. */
export const resetPasswordSchema = z
  .object({
    password: newStaffPasswordSchema,
    confirmPassword: z.string().min(1, 'Enter the password again.'),
  })
  // The mismatch message belongs to the second field, where the mistake is.
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

/** The reset form's values after checking. */
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

/**
 * How many digits the emailed sign-in code has (D114). It must equal the Supabase project's
 * "Email OTP Length" setting, which the student sign-up code (D99) already uses.
 */
export const SIGN_IN_CODE_LENGTH = 6

/**
 * A typed or pasted code with everything but its digits removed. People paste "482 913" or
 * "482-913" from the email, and a phone's keyboard may add a space.
 */
export function cleanSignInCode(text: string): string {
  // Keep the digits only.
  return text.replaceAll(/\D/g, '')
}

/**
 * The code form: the emailed digits, cleaned first, then counted.
 * SECURITY: checked again by the service, so a request that skips the form can send Supabase
 * nothing but six digits.
 */
export const signInCodeSchema = z.object({
  // Cleaned before it is counted, so a pasted code with a space passes.
  code: z
    .string()
    .transform(cleanSignInCode)
    .pipe(
      z
        .string()
        .length(SIGN_IN_CODE_LENGTH, `Enter the ${String(SIGN_IN_CODE_LENGTH)}-digit code.`),
    ),
})
