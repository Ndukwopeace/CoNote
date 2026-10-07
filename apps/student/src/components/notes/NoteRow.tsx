/**
 * One note on the Notes page (FR-NTE-7): course icon, title, course code and class, date and
 * tags, with an edit icon and a menu (Open, Edit, Delete).
 */

// Icons.
import { ExternalLink, MoreVertical, Pencil, Trash2 } from 'lucide-react'
// Client-side links.
import { Link } from 'react-router'

// The course colour.
import { CourseIcon } from '@/components/common/CourseIcon'
// The row menu.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conote/ui/dropdown-menu'
// Relative times.
import { formatRelativeTime } from '@/lib/dates'
// Link builders.
import { routeTo } from '@/lib/routes'
// The note shape.
import type { Note } from '@/types/domain'

/** What a row shows and does. */
interface NoteRowProps {
  // The note.
  note: Note
  // e.g. "SWE 311 · SDLC Models"; empty if the class is unknown.
  classLabel: string
  // The current time, for "5 min ago".
  now: Date
  // Asks to delete the note (the page confirms first).
  onDelete: (note: Note) => void
}

/** A list item for one note. */
export function NoteRow({ note, classLabel, now, onDelete }: Readonly<NoteRowProps>) {
  // The title to show.
  const title = note.title ?? 'Untitled note'
  // Shared icon-button look: 40 px square, visible focus ring.
  const iconButton =
    'flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50'

  return (
    <li className="flex items-start gap-3 p-4">
      {/* Course colour. */}
      <CourseIcon courseId={note.courseId} />
      {/* Title, class, time and tags. */}
      <div className="min-w-0 flex-1 space-y-1">
        {/* The title opens the note. */}
        <Link
          to={routeTo.note(note.id)}
          className="block font-semibold hover:text-primary hover:underline"
        >
          {title}
        </Link>
        {/* Course code and class, then when it was last edited. */}
        <p className="text-sm text-muted-foreground">
          {classLabel}
          {classLabel && ' · '}
          <time dateTime={note.updatedAt}>{formatRelativeTime(note.updatedAt, now)}</time>
        </p>
        {/* Tags. */}
        {note.tags.length > 0 && (
          <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-accent-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Edit, one tap away. Named with the title so screen readers know which note. */}
      <Link to={routeTo.editNote(note.id)} aria-label={`Edit ${title}`} className={iconButton}>
        <Pencil aria-hidden="true" className="size-4" />
      </Link>
      {/* The menu: Open, Edit, Delete. */}
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`More actions for ${title}`} className={iconButton}>
          <MoreVertical aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={routeTo.note(note.id)}>
              <ExternalLink aria-hidden="true" />
              Open
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={routeTo.editNote(note.id)}>
              <Pencil aria-hidden="true" />
              Edit
            </Link>
          </DropdownMenuItem>
          {/* Red, and confirmed by the page before anything is deleted. */}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              onDelete(note)
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
