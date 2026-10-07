/**
 * The Notes page's course filter, text search and sort (FR-NTE-7).
 */

// Reads note text for search.
import { htmlToText } from './notes'
// The note shape.
import type { Note } from '@/types/domain'

/** The two sort orders. */
export type NoteSort = 'newest' | 'oldest'

/**
 * Reads the sort from the address (?sort=).
 * SECURITY: only the two known values are accepted; anything else is "newest".
 */
export function parseNoteSort(value: string | null): NoteSort {
  // Exact match, else the default.
  return value === 'oldest' ? 'oldest' : 'newest'
}

/** Notes for one course (or all when `courseId` is ''), matching the search, in the chosen order. */
export function filterNotes(
  notes: readonly Note[],
  { courseId, query, sort }: Readonly<{ courseId: string; query: string; sort: NoteSort }>,
): Note[] {
  // Case and surrounding spaces don't matter.
  const needle = query.trim().toLowerCase()
  // Newest edit first, or oldest; ISO strings compare correctly as dates once parsed.
  const direction = sort === 'newest' ? -1 : 1
  return (
    notes
      // The course filter.
      .filter((note) => courseId === '' || note.courseId === courseId)
      // The search: title, tags, then the visible text (never the markup).
      .filter(
        (note) =>
          needle === '' ||
          [note.title ?? '', ...note.tags, htmlToText(note.contentHtml)].some((field) =>
            field.toLowerCase().includes(needle),
          ),
      )
      // The order; a copy was made by filter, so the input is untouched.
      .sort((a, b) => direction * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)))
  )
}
