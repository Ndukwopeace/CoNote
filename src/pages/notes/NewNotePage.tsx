/**
 * New note, at /notes/new, optionally ?classId= to file it under a class (FR-NTE-1).
 */

// The query string.
import { useSearchParams } from 'react-router'

// Tab title.
import { PageTitle } from '@/components/common/PageTitle'
// The form.
import { NoteForm } from '@/features/notes/NoteForm'

/** New note. */
export function NewNotePage() {
  // The class, if the page was opened from one; NoteForm checks it is one of the student's.
  const [params] = useSearchParams()
  const classId = params.get('classId')

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Tab title. */}
      <PageTitle title="New note" />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">New note</h1>
      {/* The form; keyed by class so opening another class's editor starts fresh. */}
      <NoteForm key={classId ?? 'none'} mode={{ kind: 'new', classId }} />
    </div>
  )
}
