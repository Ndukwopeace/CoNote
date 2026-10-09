/**
 * Reads emails and student numbers from pasted text or a CSV file, for bulk enrolment (admin
 * REQUIREMENTS section 12). The service decides who each value is; this only splits and tidies.
 */

/** The most values one enrolment reads. SECURITY: caps the work a huge paste or file can cause. */
export const MAX_IDENTIFIERS = 500

/** Header cells a spreadsheet export may start with, in lower case. */
const HEADERS = new Set(['email', 'emails', 'email address', 'student number', 'student_number'])

/** The distinct values in `text`, in order, without quotes or a header row. */
export function parseIdentifiers(text: string): string[] {
  // Split on line breaks, commas and semicolons; trim each value and its quotes.
  const values = text
    .split(/[\r\n,;]+/)
    .map((value) =>
      value
        .trim()
        .replaceAll(/^["']+|["']+$/g, '')
        .trim(),
    )
    .filter(Boolean)
  // Skip a header row, which is the first value when it names a column.
  const start = values[0] && HEADERS.has(values[0].toLowerCase()) ? 1 : 0
  // Each value once, up to the cap.
  return [...new Set(values.slice(start))].slice(0, MAX_IDENTIFIERS)
}
