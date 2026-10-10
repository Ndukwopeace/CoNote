/**
 * Checks shared by every AuthService implementation. They run inside the service, not only in
 * the forms, so a request sent some other way (the browser console, a script) meets the same
 * rules.
 */

// zod checks formats.
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'

// Rule for a well-formed email address.
const emailSchema = z.email()

/**
 * Throws a validation error carrying the first rule `value` breaks, so the student sees the
 * same message the form would have shown.
 */
export function assertRule(schema: z.ZodType, value: unknown) {
  // Check without throwing zod's own error type.
  const result = schema.safeParse(value)
  // Passed: nothing to do.
  if (result.success) return
  // The first broken rule's message, or a generic one if zod gave none.
  const message = result.error.issues[0]?.message ?? 'Check this field and try again.'
  // The app's own error type, with a message that is safe to show.
  throw new AppError('validation', message)
}

/** Throws a student-friendly validation error unless `email` is well-formed. */
export function assertEmail(email: string) {
  // Check the format.
  if (!emailSchema.safeParse(email).success) {
    // The message is shown on the form as-is.
    throw new AppError('validation', 'Enter a valid email address.')
  }
}
