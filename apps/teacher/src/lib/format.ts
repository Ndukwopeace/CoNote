/**
 * The portal's date wording, the same on every screen.
 */

/** Milliseconds in a day. */
const DAY_MS = 24 * 60 * 60 * 1000

/** "8 Oct 2026" for `iso` on the local calendar, or `fallback` when there is no date. */
export function formatDate(iso: string | null, fallback = '—'): string {
  // No date: the caller's word for it.
  if (iso === null) return fallback
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** How long something has waited: "Waiting less than a day", "Waiting 1 day", "Waiting 5 days". */
export function waitedText(sinceIso: string, now: Date): string {
  // Whole days, never negative (a clock a little behind the server's).
  const days = Math.max(0, Math.floor((now.getTime() - Date.parse(sinceIso)) / DAY_MS))
  if (days === 0) return 'Waiting less than a day'
  return days === 1 ? 'Waiting 1 day' : `Waiting ${String(days)} days`
}

/** "1 note", "18 notes". */
function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

/** "Based on 18 notes from 14 students": counts only, never the notes (D74). */
export function basedOnText(notes: number, students: number): string {
  return `Based on ${plural(notes, 'note', 'notes')} from ${plural(students, 'student', 'students')}`
}

/** "1 class", "7 classes". */
export function classesText(count: number): string {
  return plural(count, 'class', 'classes')
}

/** "1 note", "18 notes". */
export function notesText(count: number): string {
  return plural(count, 'note', 'notes')
}
