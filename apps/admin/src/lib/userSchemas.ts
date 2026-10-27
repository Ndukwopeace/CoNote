/**
 * The rules for the invite and edit forms (admin REQUIREMENTS section 11). The demo service
 * checks the same rules, as the Edge Functions will.
 */

// Schema builder.
import { z } from 'zod'

/** Every role, for the invite form's choice. */
const ROLES = ['student', 'teacher', 'admin'] as const

/** A required name: trimmed, at most 100 characters. */
const fullName = z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.')

/** Treats null (an empty field from the service's input) as a blank. */
const blankIfNull = (value: unknown) => value ?? ''

/** An optional text field: trimmed, and null when left blank. */
const optionalText = z.preprocess(
  blankIfNull,
  z
    .string()
    .trim()
    .max(100, 'Use at most 100 characters.')
    .transform((value) => (value === '' ? null : value)),
)

/** The most courses one invitation may carry (the Edge Function enforces the same limit). */
export const MAX_INVITED_COURSES = 20

/**
 * Inviting someone: their role, name and email, and for a teacher the courses they will teach
 * (D116). No one is asked for a department.
 */
export const inviteUserSchema = z
  .object({
    role: z.enum(ROLES),
    fullName,
    // Trimmed and in lower case, so the same address can't be invited twice in different cases.
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
    courseIds: z
      .array(z.string().min(1))
      .max(MAX_INVITED_COURSES, `Choose at most ${String(MAX_INVITED_COURSES)} courses.`)
      .optional(),
  })
  // SECURITY: courses are for teachers only, so the form and both services refuse them for anyone
  // else. The Edge Function checks again.
  .refine((values) => values.role === 'teacher' || (values.courseIds ?? []).length === 0, {
    message: 'Only teachers can be given courses.',
    path: ['courseIds'],
  })

/** The invite form's values. */
export type InviteUserValues = z.input<typeof inviteUserSchema>

/** Editing someone's profile. */
export const editUserSchema = z.object({
  fullName,
  department: optionalText,
  level: optionalText,
  // Digits, spaces, + and - only, so the field can't hold anything else.
  phone: z.preprocess(
    blankIfNull,
    z
      .string()
      .trim()
      .regex(/^[\d +-]*$/, 'Enter a phone number using digits, spaces, + and -.')
      .max(30, 'Use at most 30 characters.')
      .transform((value) => (value === '' ? null : value)),
  ),
  studentNumber: optionalText,
  staffNumber: optionalText,
})

/** The edit form's values, as typed. */
export type EditUserValues = z.input<typeof editUserSchema>
