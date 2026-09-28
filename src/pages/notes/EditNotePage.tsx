/**
 * Edit note, at /notes/:noteId/edit (FR-NTE-1).
 */

// The note ID from the address.
import { useParams } from 'react-router'

// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Missing-note panel.
import { NotFoundPanel } from '@/components/common/NotFoundPanel'
// Tab title.
import { PageTitle } from '@/components/common/PageTitle'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// The form.
import { NoteForm } from '@/features/notes/NoteForm'
// The note.
import { useNote } from '@/hooks/useNoteMutations'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** Edit note. */
export function EditNotePage() {
  // The note ID; the route always has one.
  const { noteId = '' } = useParams()
  // The note.
  const note = useNote(noteId)

  // Failed, or no such note (or not the student's).
  if (note.isError) {
    return (
      <LoadError
        error={note.error}
        onRetry={() => void note.refetch()}
        notFound={
          <NotFoundPanel title="Note not found" backTo={ROUTES.notes} backLabel="Back to Notes" />
        }
      />
    )
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Tab title. */}
      <PageTitle title="Edit note" />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Edit note</h1>
      {/* The form once the note has loaded; keyed by note so switching notes starts fresh. */}
      {note.data ? (
        <NoteForm key={note.data.id} mode={{ kind: 'edit', note: note.data }} />
      ) : (
        <ListSkeleton rows={3} />
      )}
    </div>
  )
}
