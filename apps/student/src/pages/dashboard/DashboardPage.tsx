/**
 * Home, at /dashboard (D101): the frequent job comes first. It opens on "Let's CoNote" and the
 * note form, with the class already chosen, so writing a note takes no navigation. A student in no
 * courses sees the way to find some instead (FR-DSH-6, FR-ENR-1, FR-ENR-2).
 */

// Icon for the no-courses state.
import { GraduationCap } from 'lucide-react'
// The saved note, for the line under the form.
import { useState } from 'react'
// Client-side links.
import { Link } from 'react-router'

// Enrolment empty state.
import { EmptyState } from '@conote/ui/common/EmptyState'
// Asking to join courses (FR-ENR).
import { JoinCoursesDialog } from '@/features/enrolment/JoinCoursesDialog'
import { useJoinPrompt } from '@/features/enrolment/useJoinPrompt'
import { useMyJoinRequests } from '@/hooks/useEnrolment'
// Standard button.
import { Button } from '@conote/ui/button'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// Sign-in state, for the name.
import { useAuth } from '@/features/auth/useAuth'
// The note form.
import { NoteForm } from '@/features/notes/NoteForm'
// Data hooks.
import { useMyCourses } from '@/hooks/useCourses'
import { useNow } from '@/hooks/useNow'
// Greeting.
import { greetingFor } from '@/lib/dates'
// "Victory Okafor" → "Victory".
import { firstName } from '@conote/core/initials'
// Route constants and builders.
import { ROUTES, routeTo } from '@/lib/routes'
// The saved note's shape.
import type { Note } from '@/types/domain'

/** Home. The statement shows at once; the form follows the data. */
export function DashboardPage() {
  // Current sign-in state.
  const auth = useAuth()
  // The current time, refreshed each minute so the greeting keeps up.
  const now = useNow()
  // The first name when signed in (always true behind the guard), otherwise empty.
  const name = auth.status === 'signedIn' ? firstName(auth.session.user.fullName) : ''

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Tab title "Home", matching the tab bar (D35). */}
      <PageTitle title="Home" />
      <header>
        {/* The statement is the page heading (D101). */}
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Let&apos;s CoNote</h1>
        {/* A quiet greeting under it. */}
        <p className="mt-1 text-muted-foreground">
          {greetingFor(now)}, {name}.
        </p>
      </header>
      {/* Everything that needs data. */}
      <HomeContent />
    </div>
  )
}

/** The data-driven part of Home, with its loading, error and empty states. */
function HomeContent() {
  // The student's courses decide whether there is anything to write a note for.
  const courses = useMyCourses()
  // How many notes were saved here, which starts the form again; and the last one, for the link.
  const [round, setRound] = useState(0)
  const [saved, setSaved] = useState<Note | null>(null)

  // Failed: one message and a retry.
  if (courses.isError) {
    return (
      <LoadError
        error={courses.error}
        onRetry={() => {
          void courses.refetch()
        }}
      />
    )
  }
  // Still loading: the shape of the form.
  if (!courses.data) return <ListSkeleton rows={3} />
  // Not enrolled in anything: there is no class to write for (FR-DSH-6).
  if (courses.data.length === 0) return <NoCourses />

  return (
    <div className="space-y-4">
      {/* After a save: the next step, and a way to see the note where it was filed. */}
      {saved && (
        <output className="block text-sm text-muted-foreground">
          Note saved.{' '}
          <Link
            to={`${routeTo.class(saved.courseId, saved.classId)}?tab=notes`}
            className="font-medium text-primary hover:underline"
          >
            See it in the class
          </Link>
        </output>
      )}
      {/* The form; a new key after each save gives a fresh note, ready for the next thought. */}
      <NoteForm
        key={round}
        mode={{ kind: 'new', classId: null }}
        onSaved={(note) => {
          setSaved(note)
          setRound((count) => count + 1)
        }}
      />
    </div>
  )
}

/**
 * Home for a student who is in no courses (FR-DSH-6, FR-ENR-1, FR-ENR-2): the empty state with a
 * way to find courses, and the "Join your courses" dialog, which opens by itself once when the
 * student has no requests either.
 */
function NoCourses() {
  // The requests already made.
  const requests = useMyJoinRequests()
  // The dialog opens by itself once the page knows there are no requests.
  const prompt = useJoinPrompt(requests.data?.length === 0)
  // How many requests are waiting, for the line under the message.
  const waiting = requests.data?.filter((request) => request.status === 'pending').length ?? 0

  return (
    <>
      <EmptyState
        icon={GraduationCap}
        title="No courses yet"
        action={
          <Button type="button" onClick={prompt.open}>
            Find courses
          </Button>
        }
      >
        You&apos;re not enrolled in any courses yet. Find a course to request to join, or wait for
        your teacher or administrator to add you.
        {/* Requests already made, with the way to see them. */}
        {waiting > 0 && (
          <>
            {' '}
            {waiting === 1 ? '1 request is' : `${String(waiting)} requests are`} waiting for
            approval; see {waiting === 1 ? 'it' : 'them'} in{' '}
            <Link to={ROUTES.courses} className="font-medium text-primary hover:underline">
              My Courses
            </Link>
            .
          </>
        )}
      </EmptyState>
      <JoinCoursesDialog open={prompt.isOpen} onOpenChange={prompt.onOpenChange} />
    </>
  )
}
