/**
 * The profile form's rules (FR-SET-1), shared with the profile service.
 */

// zod describes the fields and their messages.
import { z } from 'zod'

// The name rule shared with sign-up.
import { fullNameSchema } from './authSchemas'

/** An optional short text field: trimmed, up to `max` characters. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `Keep ${label} to ${String(max)} characters or fewer.`)
}

/** The editable profile fields. Email is read-only here (it changes under Account). */
export const profileSchema = z.object({
  // Shown across the portal.
  fullName: fullNameSchema,
  // Optional department, e.g. Computer Science.
  department: optionalText(80, 'the department'),
  // Optional level or year, e.g. 300.
  level: optionalText(40, 'the level'),
  // Optional phone: digits, spaces, +, - and brackets, 7 to 20 characters, or blank.
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^[+\d][\d\s()-]{6,19}$/.test(value),
      'Enter a phone number using digits, spaces, + or -.',
    ),
})

/** What the profile form holds. */
export type ProfileValues = z.input<typeof profileSchema>
