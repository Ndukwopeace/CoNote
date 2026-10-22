/**
 * One of the student's notes in the Home stream (D102): the text as a bubble, with its tags and
 * time underneath, a link to the note and one to edit it here in the composer (D109).
 */

// Client-side links.
import { Link } from 'react-router'

// User HTML renders only through SafeHtml.
import { SafeHtml } from '@/components/common/SafeHtml'
// Time of day.
import { formatClockTime } from '@/lib/dates'
// Note address.
import { routeTo } from '@/lib/routes'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shape.
import type { Note } from '@/types/domain'

/** A note bubble. */
export function NoteBubble({ note, editing = false }: Readonly<{ note: Note; editing?: boolean }>) {
  // "Key concept · 10:42 AM".
  const meta = [...note.tags, formatClockTime(note.createdAt)].join(' · ')
  return (
    <li className="ml-auto flex max-w-[86%] flex-col items-end gap-1">
      {/* SECURITY: note HTML renders only through SafeHtml. A word with no spaces (a link, a
          formula, a pasted string) is broken where it meets the edge: otherwise it sets the
          bubble's width, which then runs off the left of the screen. */}
      <SafeHtml
        html={note.contentHtml}
        className={cn(
          'max-w-full rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-base leading-snug [overflow-wrap:anywhere] text-accent-foreground [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5',
          // The note being edited is marked, so it is clear which one the composer holds.
          editing && 'ring-2 ring-primary',
        )}
      />
      <p className="text-xs text-muted-foreground">
        {meta}
        {' · '}
        <Link to={routeTo.note(note.id)} className="font-medium text-primary-dark hover:underline">
          Open<span className="sr-only"> note</span>
        </Link>
        {' · '}
        <Link
          to={routeTo.editNote(note.id)}
          className="font-medium text-primary-dark hover:underline"
        >
          Edit<span className="sr-only"> note</span>
        </Link>
      </p>
    </li>
  )
}
