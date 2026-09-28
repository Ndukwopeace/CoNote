/**
 * A list of the student's notes: title, tags and when it was last edited. Each opens the note.
 */

// Client-side link.
import { Link } from 'react-router'

// Relative times.
import { formatRelativeTime } from '@/lib/dates'
// Link builder.
import { routeTo } from '@/lib/routes'
// The note shape.
import type { Note } from '@/types/domain'

/** The notes as one bordered list. */
export function NoteList({ notes, now }: Readonly<{ notes: readonly Note[]; now: Date }>) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {notes.map((note) => (
        <li key={note.id}>
          {/* Opens the note (the reader arrives in M4). */}
          <Link
            to={routeTo.note(note.id)}
            className="block p-4 outline-none hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {/* Title as plain text, never HTML; untitled notes get a stand-in. */}
            <span className="block font-medium">{note.title ?? 'Untitled note'}</span>{' '}
            {/* Tags and time. */}
            <span className="block text-sm text-muted-foreground">
              {note.tags.join(', ')}
              {note.tags.length > 0 && ' · '}
              {formatRelativeTime(note.updatedAt, now)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
