/**
 * The rules for the class form (admin REQUIREMENTS section 13). The demo service checks the same
 * rules, as the database constraints and Edge Functions will.
 */

// Schema builder.
import { z } from 'zod'

// Local date and time to instants.
import { toIso } from './classTimes'

/** A real calendar date written YYYY-MM-DD. */
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date.')
  .refine((value) => {
    // Rejects dates like 2026-02-31, which `Date` would roll over.
    const [year = 0, month = 1, day = 1] = value.split('-').map(Number)
    const parsed = new Date(year, month - 1, day)
    return parsed.getMonth() === month - 1 && parsed.getDate() === day
  }, 'Enter a date.')

/** A time written HH:MM on a 24-hour clock. */
const time = (message: string) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, message)

/** Creating or editing a class. */
export const classSchema = z
  .object({
    courseId: z.string().trim().min(1, 'Choose a course.'),
    title: z.string().trim().min(1, 'Enter a title.').max(150, 'Use at most 150 characters.'),
    date,
    startTime: time('Enter a start time.'),
    endTime: time('Enter an end time.'),
    description: z.string().trim().max(1000, 'Use at most 1000 characters.'),
  })
  // The class must end after it starts (on the same day).
  .refine((values) => toIso(values.date, values.endTime) > toIso(values.date, values.startTime), {
    message: 'The end time must be after the start time.',
    path: ['endTime'],
  })

/** The class form's values, as typed. */
export type ClassValues = z.input<typeof classSchema>
