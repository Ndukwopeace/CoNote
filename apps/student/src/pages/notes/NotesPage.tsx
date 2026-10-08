/**
 * Notes, at /notes (FR-NTE-7): My Notes (course filter, search, sort, row menu) and Summaries,
 * chosen with ?tab=notes|summaries. Filter, search and sort live in ?course=, ?q= and ?sort=.
 */

// Icons.
import { FileCheck2, NotebookPen, Plus, Search, SearchX } from 'lucide-react'
// Dialog state.
import { useState } from 'react'
// Links and the query string.
import { Link, useSearchParams } from 'react-router'

// Yes/no dialog.
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
// Empty states.
import { EmptyState } from '@/components/common/EmptyState'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// The summaries list.
import { SummaryList } from '@/components/common/SummaryList'
// One note row.
import { NoteRow } from '@/components/notes/NoteRow'
// Button, input and tabs.
import { Button, buttonVariants } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@conote/ui/tabs'
// Toast messages.
import { useToast } from '@conote/ui/toast'
// Data hooks.
import { useMyClasses } from '@/hooks/useClasses'
import { useMyCourses } from '@/hooks/useCourses'
import { useDeleteNote } from '@/hooks/useNoteMutations'
import { useMyNotes } from '@/hooks/useNotes'
import { useNow } from '@/hooks/useNow'
import { usePublishedSummaries } from '@/hooks/useSummaries'
// Note list rules.
import { filterNotes, parseNoteSort } from '@/lib/noteList'
// Route constants.
import { ROUTES } from '@/lib/routes'
// Reads ?tab= safely.
import { parseTab } from '@/lib/tabs'
// Shapes.
import type { Note } from '@/types/domain'

/** The tabs; the first is the default. */
const NOTES_TABS: ['notes', 'summaries'] = ['notes', 'summaries']

/** The Notes page. */
export function NotesPage() {
  // The address's query string.
  const [params, setParams] = useSearchParams()
  // SECURITY: only known tab names are used (see parseTab).
  const tab = parseTab(params.get('tab'), NOTES_TABS)

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Tab title. */}
      <PageTitle title="Notes" />
      {/* Heading and New note. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Notes</h1>
        <Link to={ROUTES.newNote} className={buttonVariants()}>
          <Plus aria-hidden="true" />
          New note
        </Link>
      </div>
      {/* The two tabs; switching keeps the filters but replaces the history entry. */}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setParams(
            (current) => {
              const next = new URLSearchParams(current)
              next.set('tab', parseTab(value, NOTES_TABS))
              return next
            },
            { replace: true },
          )
        }}
      >
        <TabsList aria-label="Notes sections">
          <TabsTrigger value="notes">My Notes</TabsTrigger>
          <TabsTrigger value="summaries">Summaries</TabsTrigger>
        </TabsList>
        <TabsContent value="notes">
          <MyNotes />
        </TabsContent>
        <TabsContent value="summaries">
          <Summaries />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** My Notes: filter row and the list, with every state. */
function MyNotes() {
  // The notes, and the courses and classes to label them.
  const notes = useMyNotes()
  const courses = useMyCourses()
  const classes = useMyClasses()
  // The clock.
  const now = useNow()
  // Toasts.
  const toast = useToast()
  // The delete call.
  const remove = useDeleteNote()
  // The note waiting for delete confirmation.
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)
  // Filter, search and sort from the address. Unknown courses simply match nothing.
  const [params, setParams] = useSearchParams()
  const courseId = params.get('course') ?? ''
  const query = params.get('q') ?? ''
  const sort = parseNoteSort(params.get('sort'))

  /** Sets or removes one parameter, replacing the history entry. */
  function setParam(name: 'course' | 'q' | 'sort', value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        // Defaults are left out, keeping the address short.
        if (value === '' || (name === 'sort' && value === 'newest')) next.delete(name)
        else next.set(name, value)
        return next
      },
      { replace: true },
    )
  }

  // Failed.
  const failed = notes.error ?? courses.error ?? classes.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void notes.refetch()
          void courses.refetch()
          void classes.refetch()
        }}
      />
    )
  }
  // Loading.
  if (!notes.data || !courses.data || !classes.data) return <ListSkeleton rows={4} />
  // No notes at all.
  if (notes.data.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="No notes yet"
        action={
          <Link to={ROUTES.newNote} className={buttonVariants()}>
            Write your first note
          </Link>
        }
      >
        Your notes are private. Only you can see them.
      </EmptyState>
    )
  }

  // Labels for each row: "SWE 311 · SDLC Models".
  const courseCode = new Map(courses.data.map((c) => [c.id, c.code]))
  const classLabel = new Map(
    classes.data.map((c) => [c.id, `${courseCode.get(c.courseId) ?? ''} · ${c.title}`]),
  )
  // The notes left after filter and search, in order.
  const visible = filterNotes(notes.data, { courseId, query, sort })

  /** Deletes after confirmation; the row goes at once and returns if the delete fails. */
  function confirmDelete() {
    if (!pendingDelete) return
    remove
      .mutateAsync(pendingDelete.id)
      .then(() => {
        toast.success('Note deleted.')
      })
      .catch(() => {
        toast.error("Couldn't delete the note. It has been put back.")
      })
  }

  return (
    <div className="space-y-4">
      {/* Search, course and sort: stacked on phones, one row from tablets up. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search notes"
            placeholder="Title, tag or text"
            value={query}
            onChange={(event) => {
              setParam('q', event.target.value)
            }}
            className="pl-9"
          />
        </div>
        {/* Course and sort share a row, even on phones. */}
        <div className="flex gap-3">
          <select
            aria-label="Course"
            value={courseId}
            onChange={(event) => {
              setParam('course', event.target.value)
            }}
            className="h-10 min-w-0 flex-1 rounded-md border bg-card px-3 text-sm md:flex-none"
          >
            <option value="">All courses</option>
            {courses.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(event) => {
              setParam('sort', event.target.value)
            }}
            className="h-10 min-w-0 flex-1 rounded-md border bg-card px-3 text-sm md:flex-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        // Nothing matches: say so and offer the way out.
        <EmptyState
          icon={SearchX}
          title="No notes match"
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setParams({}, { replace: true })
              }}
            >
              Clear search and filter
            </Button>
          }
        >
          Try a different search or course.
        </EmptyState>
      ) : (
        <ul aria-label="My notes" className="divide-y rounded-xl border bg-card">
          {visible.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              classLabel={classLabel.get(note.classId) ?? ''}
              now={now}
              onDelete={setPendingDelete}
            />
          ))}
        </ul>
      )}

      {/* Delete is final, so ask first (FR-NTE-8). */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete this note?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  )
}

/** Summaries: every published summary across the student's courses, newest first. */
function Summaries() {
  // Summaries, and classes and courses to label them.
  const summaries = usePublishedSummaries()
  const classes = useMyClasses()
  const courses = useMyCourses()
  // The clock.
  const now = useNow()

  // Failed.
  const failed = summaries.error ?? classes.error ?? courses.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void summaries.refetch()
          void classes.refetch()
          void courses.refetch()
        }}
      />
    )
  }
  // Loading.
  if (!summaries.data || !classes.data || !courses.data) return <ListSkeleton rows={3} />
  // None yet.
  if (summaries.data.length === 0) {
    return (
      <EmptyState icon={FileCheck2} title="No summaries yet">
        Summaries appear here once your teachers approve them.
      </EmptyState>
    )
  }

  return (
    <SummaryList
      summaries={summaries.data}
      classById={new Map(classes.data.map((c) => [c.id, c]))}
      courseCodeById={new Map(courses.data.map((c) => [c.id, c.code]))}
      now={now}
    />
  )
}
