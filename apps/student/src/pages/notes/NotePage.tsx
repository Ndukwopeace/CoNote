/**
 * A note, at /notes/:noteId (FR-NTE-10): the sanitised body, tags, class link and times, with
 * Edit and Delete (FR-NTE-8).
 */

// Icons.
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
// Dialog state.
import { useState } from 'react'
// The note ID, links and navigation.
import { Link, useNavigate, useParams } from 'react-router'

// Yes/no dialog.
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Missing-note panel.
import { NotFoundPanel } from '@/components/common/NotFoundPanel'
// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// The only way user HTML reaches the page.
import { SafeHtml } from '@/components/common/SafeHtml'
// Loading placeholders.
import { HeaderSkeleton, ListSkeleton } from '@/components/common/Skeletons'
// Button styles.
import { Button, buttonVariants } from '@conote/ui/button'
// Toast messages.
import { useToast } from '@conote/ui/toast'
// Data hooks.
import { useMyClasses } from '@/hooks/useClasses'
import { useMyCourses } from '@/hooks/useCourses'
import { useDeleteNote, useNote } from '@/hooks/useNoteMutations'
import { useNow } from '@/hooks/useNow'
// Relative times.
import { formatRelativeTime } from '@/lib/dates'
// Route constants and builders.
import { ROUTES, routeTo } from '@/lib/routes'
// Shapes.
import type { Note } from '@/types/domain'

/** The note page. */
export function NotePage() {
  // The note ID; the route always has one.
  const { noteId = '' } = useParams()
  // The note, and the classes and courses to name its class.
  const note = useNote(noteId)
  const classes = useMyClasses()
  const courses = useMyCourses()

  // Failed, or no such note (or not the student's).
  const failed = note.error ?? classes.error ?? courses.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void note.refetch()
          void classes.refetch()
          void courses.refetch()
        }}
        notFound={
          <NotFoundPanel title="Note not found" backTo={ROUTES.notes} backLabel="Back to Notes" />
        }
      />
    )
  }
  // Loading.
  if (!note.data || !classes.data || !courses.data) {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <HeaderSkeleton />
        <ListSkeleton rows={2} announce={false} />
      </div>
    )
  }

  // The note's class and course, for the link.
  const session = classes.data.find((c) => c.id === note.data.classId)
  const course = courses.data.find((c) => c.id === note.data.courseId)
  return (
    <NoteView
      note={note.data}
      classLabel={session ? `${course?.code ?? ''} · ${session.title}` : null}
    />
  )
}

/** The loaded note. */
function NoteView({ note, classLabel }: Readonly<{ note: Note; classLabel: string | null }>) {
  // Navigation after delete.
  const navigate = useNavigate()
  // Toasts.
  const toast = useToast()
  // The delete call.
  const remove = useDeleteNote()
  // The clock, for "5 min ago".
  const now = useNow()
  // Whether the delete dialog is open.
  const [confirming, setConfirming] = useState(false)
  // The title to show; notes are always saved with one, but older data may lack it.
  const title = note.title ?? 'Untitled note'

  /** Deletes, returning to Notes at once (the list already lacks it); failure brings it back. */
  function deleteNote() {
    // Not awaited: the page is left straight away, and the toasts come from the app-wide provider.
    remove
      .mutateAsync(note.id)
      .then(() => {
        toast.success('Note deleted.')
      })
      .catch(() => {
        toast.error("Couldn't delete the note. It has been put back.")
      })
    void navigate(ROUTES.notes)
  }

  return (
    <article className="w-full max-w-3xl space-y-6">
      {/* Tab title. */}
      <PageTitle title={title} />
      {/* Back to Notes. */}
      <Link
        to={ROUTES.notes}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Notes
      </Link>

      <header className="space-y-3">
        {/* The class the note belongs to, linking to it. */}
        {classLabel && (
          <Link
            to={routeTo.class(note.courseId, note.classId)}
            className="text-sm font-semibold text-muted-foreground hover:text-primary hover:underline"
          >
            {classLabel}
          </Link>
        )}
        {/* Title, as text. */}
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {/* Times. */}
        <p className="text-sm text-muted-foreground">
          Created <time dateTime={note.createdAt}>{formatRelativeTime(note.createdAt, now)}</time>
          {note.updatedAt !== note.createdAt && (
            <>
              {' · '}Edited{' '}
              <time dateTime={note.updatedAt}>{formatRelativeTime(note.updatedAt, now)}</time>
            </>
          )}
        </p>
        {/* Tags. */}
        {note.tags.length > 0 && (
          <ul aria-label="Tags" className="flex flex-wrap gap-2">
            {note.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-accent-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        {/* Edit and Delete. */}
        <div className="flex gap-2">
          <Link
            to={routeTo.editNote(note.id)}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Pencil aria-hidden="true" />
            Edit
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setConfirming(true)
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        </div>
      </header>

      {/* SECURITY: the body goes through SafeHtml, which sanitises it, so stored markup can't
          run scripts in the student's browser (XSS). */}
      <SafeHtml
        html={note.contentHtml}
        className="note-content rounded-xl border bg-card p-4 md:p-6"
      />

      {/* Delete is final, so ask first (FR-NTE-8). */}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this note?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={deleteNote}
      />
    </article>
  )
}
