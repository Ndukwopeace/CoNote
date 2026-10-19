/**
 * What the timetable import's first step collects and hands on (D105), kept apart from the form
 * component so the page can share it.
 */

// The term's shape.
import type { TermDates } from '@/lib/timetable/term'

/** The time zone the form starts with. */
export const DEFAULT_TIME_ZONE = 'Africa/Douala'

/** What the form collects. */
export interface ImportFormValues {
  file: File | null
  start: string
  end: string
  // The days off as typed.
  skip: string
  timezone: string
}

/** What a checked form gives the page. */
export interface ImportRequest {
  file: File
  term: TermDates
  timezone: string
}

/** The form's empty values. */
export const EMPTY_IMPORT_VALUES: ImportFormValues = {
  file: null,
  start: '',
  end: '',
  skip: '',
  timezone: DEFAULT_TIME_ZONE,
}

/** Which of the two date fields a term problem is about; order and length problems sit on the end. */
export function termField(message: string): 'start' | 'end' {
  return message.includes('start date as') ? 'start' : 'end'
}
