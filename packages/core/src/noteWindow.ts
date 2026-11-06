/**
 * The window in which students may write notes about a class (D123): from its start until one
 * hour after its end. The database enforces it (`app.class_open_for_notes`); the apps use this
 * copy to offer only classes that are open and to explain a refusal in plain words.
 */

/** How long after a class ends a student may still write or edit a note about it. */
export const NOTES_WINDOW_MINUTES = 60

/** The start and end of one class, as ISO 8601 text. */
export interface NoteWindowClass {
  startsAt: string
  endsAt: string
}

/** Where a class is in its note window: not yet, open, or over. */
export type NoteWindowState = 'not_started' | 'open' | 'closed'

/**
 * Where `now` falls for the class. The start counts as open and so does the last moment of the
 * final hour. Times that cannot be read give "closed", never "open", so a bad value cannot let
 * notes through.
 */
export function noteWindowState(session: NoteWindowClass, now: Date): NoteWindowState {
  // The moment to test, and the class's times, as numbers.
  const at = now.getTime()
  const start = Date.parse(session.startsAt)
  const end = Date.parse(session.endsAt)
  // Unreadable text gives NaN, which fails every comparison below and so ends as "closed".
  if (at < start) return 'not_started'
  if (at <= end + NOTES_WINDOW_MINUTES * 60_000) return 'open'
  return 'closed'
}

/**
 * The sentence for a student whose note was turned away because of the window, or nothing when
 * the window is open. One wording for the demo, the real service and the screens.
 */
export function noteWindowRefusal(state: NoteWindowState): string | undefined {
  if (state === 'not_started') return 'That class has not started yet.'
  if (state === 'closed') return 'Notes for that class closed one hour after it ended.'
  return undefined
}
