/**
 * The screen both staff portals use to read students' notes (D123). For one class it shows how
 * many notes came from how many of the enrolled students, who has not written yet, and the notes
 * themselves with their authors, newest first, a page at a time, with a search by student. Without
 * a class (the administrator's search across courses) it shows the matching notes only.
 *
 * Note text is shown as plain text, never as HTML, so nothing a student typed can run or link out
 * of a staff browser. A parent that changes `classId` or `courseId` gives this a new `key`, so the
 * search and the page start again.
 */

// Reading from the service, and keeping the last page on screen while the next one loads.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
// The icon of the empty state.
import { NotebookPen } from 'lucide-react'
// Local state.
import { useState, type SyntheticEvent } from 'react'

// The shapes, the page size and the counts.
import {
  NOTES_PAGE_SIZE,
  rosterSummary,
  type NoteEntry,
  type NoteReadingService,
} from '@conote/core/noteReading'
// Plain text from stored HTML.
import { noteHtmlToText } from '@conote/core/noteText'
// Shared building blocks.
import { Button } from '@conote/ui/button'
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Input } from '@conote/ui/input'
import { Skeleton } from '@conote/ui/skeleton'

import { ErrorState } from '../components/ErrorState'

/** What the explorer needs. */
interface NotesExplorerProps {
  // Where the notes come from: the app's note reading service.
  service: NoteReadingService
  // Only this course's notes, when set.
  courseId?: string | undefined
  // Only this class's notes, and the counts and roster above them, when set.
  classId?: string | undefined
  // Name the course and class on each note, for a list that spans classes.
  showWhere?: boolean
}

/** "1 note" or "3 notes". */
function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

/** A time as a person reads it, in their own time zone. */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

/** One note: who wrote it and when, where it belongs when asked, and its text. */
function NoteCard({ entry, showWhere }: Readonly<{ entry: NoteEntry; showWhere: boolean }>) {
  return (
    <li className="space-y-1 px-4 py-3">
      {/* The author and the time. */}
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold">{entry.studentName}</span>
        {entry.studentNumber !== null && (
          <span className="text-muted-foreground">{entry.studentNumber}</span>
        )}
        <span className="text-muted-foreground">{formatWhen(entry.createdAt)}</span>
      </p>
      {/* The course and class, for lists that mix classes. */}
      {showWhere && (
        <p className="text-sm text-muted-foreground">
          {`${entry.courseCode} · Class ${String(entry.classNumber)}: ${entry.classTitle}`}
        </p>
      )}
      {/* The note's title, when it has one. */}
      {entry.title !== null && entry.title !== '' && <p className="font-medium">{entry.title}</p>}
      {/* The text. Long unbroken words wrap instead of running off the screen. */}
      <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
        {noteHtmlToText(entry.contentHtml)}
      </p>
    </li>
  )
}

/** The notes and counts for a class, or the notes that match a search across classes. */
export function NotesExplorer({
  service,
  courseId,
  classId,
  showWhere = false,
}: Readonly<NotesExplorerProps>) {
  // What is typed in the box, what has been searched for, and where the page starts.
  const [typed, setTyped] = useState('')
  const [searched, setSearched] = useState('')
  const [offset, setOffset] = useState(0)

  // Who wrote how many, for a class.
  const roster = useQuery({
    queryKey: ['notes', 'roster', classId],
    queryFn: () => service.getNoteRoster(classId ?? ''),
    enabled: classId !== undefined,
  })
  // The notes of this page. The last page stays up while the next one loads.
  const studentText = searched === '' ? undefined : searched
  const notes = useQuery({
    queryKey: ['notes', 'search', { courseId, classId, studentText, offset }],
    queryFn: () =>
      service.searchNotes({
        courseId,
        classId,
        studentId: undefined,
        studentText,
        limit: NOTES_PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  /** Searches for what is typed, from the first page. */
  function search(event: SyntheticEvent) {
    event.preventDefault()
    setSearched(typed.trim())
    setOffset(0)
  }
  /** Forgets the search. */
  function clear() {
    setTyped('')
    setSearched('')
    setOffset(0)
  }

  const summary = roster.data ? rosterSummary(roster.data) : undefined
  const total = notes.data?.total ?? 0
  const last = Math.min(offset + NOTES_PAGE_SIZE, total)

  return (
    <div className="space-y-4">
      {/* The counts for the class, and who has not written. */}
      {summary && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {`${plural(summary.notes, 'note', 'notes')} from ${String(summary.writers)} of ${plural(summary.students, 'student', 'students')}`}
          </p>
          {summary.silent.length > 0 && (
            <details className="rounded-lg border bg-card px-4 py-2 text-sm">
              <summary className="cursor-pointer font-medium">{`Not written yet (${String(summary.silent.length)})`}</summary>
              <ul className="mt-2 space-y-1">
                {summary.silent.map((student) => (
                  <li key={student.studentId}>
                    {student.studentNumber === null
                      ? student.studentName
                      : `${student.studentName} · ${student.studentNumber}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {roster.isError && (
        <ErrorState thing="the class's students" onRetry={() => void roster.refetch()} />
      )}

      {/* Search by student. */}
      <form role="search" onSubmit={search} className="flex flex-wrap items-center gap-2">
        <label htmlFor="notes-student-search" className="sr-only">
          Search by student
        </label>
        <Input
          id="notes-student-search"
          type="search"
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value)
          }}
          placeholder="Student name or number"
          maxLength={100}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {searched !== '' && (
          <Button type="button" variant="ghost" onClick={clear}>
            Clear search
          </Button>
        )}
      </form>

      {/* The notes: loading, failed, empty, or the page. */}
      {notes.isPending && (
        <output aria-label="Loading notes" className="block space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </output>
      )}
      {notes.isError && <ErrorState thing="notes" onRetry={() => void notes.refetch()} />}
      {notes.data && total === 0 && (
        <EmptyState
          icon={NotebookPen}
          title={searched === '' ? 'No notes yet.' : 'No notes match.'}
        >
          {searched === ''
            ? 'No student has written a note here yet.'
            : 'Try another name or number, or clear the search.'}
        </EmptyState>
      )}
      {notes.data && total > 0 && (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {notes.data.notes.map((entry) => (
              <NoteCard key={entry.id} entry={entry} showWhere={showWhere} />
            ))}
          </ul>
          {/* Where the page sits, and the way to the others. */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>{`Showing ${String(offset + 1)} to ${String(last)} of ${String(total)}`}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={offset === 0}
                onClick={() => {
                  setOffset(Math.max(offset - NOTES_PAGE_SIZE, 0))
                }}
              >
                Previous page
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={last >= total}
                onClick={() => {
                  setOffset(offset + NOTES_PAGE_SIZE)
                }}
              >
                Next page
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
