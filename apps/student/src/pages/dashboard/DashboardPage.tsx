/**
 * Home, at /dashboard (D101, D102): the frequent job comes first. A chat-style screen: the
 * student's notes for the class on now, the composer at the bottom with the class and tags above
 * it, and a Note | Ask switch. A student in no courses sees the way to find some instead
 * (FR-DSH-6, FR-ENR-1, FR-ENR-2).
 */

// Icon for the no-courses state.
import { GraduationCap } from 'lucide-react'
// Client-side links and the query string.
import { Link, useSearchParams } from 'react-router'

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
// The stream and composer.
import { HomeWorkspace } from '@/features/home/HomeWorkspace'
// Data hooks.
import { useMyClasses } from '@/hooks/useClasses'
import { useMyCourses } from '@/hooks/useCourses'
import { useNow } from '@/hooks/useNow'
// Greeting.
import { greetingFor } from '@/lib/dates'
// "Victory Okafor" → "Victory".
import { firstName } from '@conote/core/initials'
// Route constants.
import { ROUTES } from '@/lib/routes'
// Class-name helper.
import { cn } from '@conote/ui/utils'

/** Home. The switch shows at once; the workspace follows the data. */
export function DashboardPage() {
  // Current sign-in state.
  const auth = useAuth()
  // The current time, refreshed each minute so the greeting keeps up.
  const now = useNow()
  // The first name when signed in (always true behind the guard), otherwise empty.
  const name = auth.status === 'signedIn' ? firstName(auth.session.user.fullName) : ''
  // Note or Ask, kept in the address so a link can open Home on either.
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'ask' ? 'ask' : 'note'

  /** Switches mode, keeping the rest of the address. */
  function setMode(next: 'note' | 'ask') {
    const updated = new URLSearchParams(params)
    if (next === 'ask') updated.set('mode', 'ask')
    else updated.delete('mode')
    setParams(updated, { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* Tab title "Home", matching the tab bar (D35). */}
      <PageTitle title="Home" />
      {/* Note | Ask: the same screen with a different job (D102). */}
      <div
        role="group"
        aria-label="Mode"
        className="mx-auto flex gap-0.5 rounded-full border bg-card p-1"
      >
        {(['note', 'ask'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => {
              setMode(option)
            }}
            className={cn(
              'min-h-10 rounded-full px-6 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              mode === option ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
          >
            {option === 'note' ? 'Note' : 'Ask'}
          </button>
        ))}
      </div>
      {/* Everything that needs data. */}
      <HomeContent mode={mode} onModeChange={setMode} greeting={`${greetingFor(now)}, ${name}.`} />
    </div>
  )
}

/** The data-driven part of Home, with its loading, error and empty states. */
function HomeContent({
  mode,
  onModeChange,
  greeting,
}: Readonly<{
  mode: 'note' | 'ask'
  onModeChange: (mode: 'note' | 'ask') => void
  greeting: string
}>) {
  // The courses and classes decide what there is to write for.
  const courses = useMyCourses()
  const classes = useMyClasses()

  // Failed: one message and a retry that repeats only the failed reads.
  const failed = courses.error ?? classes.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void courses.refetch()
          void classes.refetch()
        }}
      />
    )
  }
  // Still loading: the shape of the stream.
  if (!courses.data || !classes.data) return <ListSkeleton rows={3} />
  // Not enrolled in anything: there is no class to write for (FR-DSH-6).
  if (courses.data.length === 0) {
    return (
      <>
        {/* The statement still opens the page, above the way to find courses. */}
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Let&apos;s CoNote</h1>
          <p className="text-muted-foreground">{greeting}</p>
        </header>
        <NoCourses />
      </>
    )
  }

  return (
    <HomeWorkspace
      courses={courses.data}
      classes={classes.data}
      mode={mode}
      onModeChange={onModeChange}
      greeting={greeting}
    />
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
