/**
 * The profile form's rules (FR-SET-1), shared with the profile service.
 */

// zod describes the fields and their messages.
import { z } from 'zod'

// The name rule shared with sign-up.
import { fullNameSchema } from './authSchemas'
// The settings shape.
import type { NotificationPrefs } from '@/types/domain'

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

/** A new student's notification settings: everything on, except email class reminders. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  summaryPublished: { inApp: true, email: true },
  classReminders: { inApp: true, email: false },
  announcements: { inApp: true, email: true },
}

/** One channel pair: in the app, and by email. */
const channelSchema = z.object({ inApp: z.boolean(), email: z.boolean() })

/** The notification settings shape (FR-SET-3). */
export const notificationPrefsSchema = z.object({
  summaryPublished: channelSchema,
  classReminders: channelSchema,
  announcements: channelSchema,
})
