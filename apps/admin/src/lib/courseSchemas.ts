/**
 * The rules for the course form (admin REQUIREMENTS section 12). The demo service checks the
 * same rules, as the database constraints and Edge Functions will.
 */

// Schema builder.
import { z } from 'zod'

/** The course statuses, for the form's choice. */
const STATUSES = ['upcoming', 'ongoing', 'completed'] as const

/** Letters, then a space, then digits with an optional letter: "SWE 311", "CSC 101L". */
const CODE_PATTERN = /^[A-Z]{2,5} \d{3}[A-Z]?$/

/** `code` in its stored form: trimmed, upper case, one space between letters and digits. */
export function normalizeCourseCode(code: string): string {
  // Drop every space, then put one back where the letters end.
  return code
    .replaceAll(/\s+/g, '')
    .toUpperCase()
    .replace(/^([A-Z]+)(\d)/, '$1 $2')
}

/** Treats null (an empty field from the service's input) as a blank. */
const blankIfNull = (value: unknown) => value ?? ''

/** A text field that becomes null when left blank. */
function optional(max: number) {
  return z.preprocess(
    blankIfNull,
    z
      .string()
      .trim()
      .max(max, `Use at most ${max} characters.`)
      .transform((value) => (value === '' ? null : value)),
  )
}

/** Creating or editing a course. */
export const courseSchema = z.object({
  // Stored one way, so "swe311" and "SWE 311" are the same course.
  code: z
    .string()
    .transform(normalizeCourseCode)
    .pipe(z.string().regex(CODE_PATTERN, 'Enter a code like SWE 311.')),
  title: z.string().trim().min(1, 'Enter a title.').max(150, 'Use at most 150 characters.'),
  description: z.string().trim().max(1000, 'Use at most 1000 characters.'),
  department: optional(100),
  status: z.enum(STATUSES, 'Choose a status.'),
  // An ID, or null for no teacher yet.
  teacherId: optional(100),
})

/** The course form's values, as typed. */
export type CourseValues = z.input<typeof courseSchema>
