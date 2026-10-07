/**
 * The rules for the console's sign-in form (ENGINEERING_STANDARDS.md 6.3).
 */

// Schema builder.
import { z } from 'zod'

/** Sign-in: a valid email (trimmed, lower case) and any non-empty password. */
export const signInSchema = z.object({
  // Trim and lower-case first, so " Admin@Example.com " is accepted and matched as typed.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Enter a valid email address.' })),
  // The password is checked by the service; here it only has to be present.
  password: z.string().min(1, 'Enter your password.'),
})

/** The form's values after checking. */
export type SignInValues = z.infer<typeof signInSchema>
