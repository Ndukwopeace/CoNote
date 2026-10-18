/**
 * Home's navigation (D103): the drawer on phones and the sidebar on wider screens. The classes
 * of today and earlier (choosing one files the next notes under it), then Summaries, All notes,
 * Courses, Classes and Settings, and the way to sign out.
 */

// Icon for the sign-out button.
import { LogOut } from 'lucide-react'
// Client-side links.
import { Link } from 'react-router'

// The CoNote logo.
import { Logo } from '@conote/ui/common/Logo'
// Sign-in state: signing out.
import { useAuth } from '@/features/auth/useAuth'
// Class rules.
import { groupClassesByDay } from '@/lib/classes'
// Addresses.
import { ROUTES } from '@/lib/routes'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shapes.
import type { ClassSession, Course } from '@/types/domain'

/** How many earlier classes the navigation lists. */
const EARLIER_LIMIT = 4

/** The look of one row, link or button. */
const ROW =
  'flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[0.9375rem] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** What the navigation shows and calls. */
interface HomeNavProps {
  classes: readonly ClassSession[]
  courses: readonly Course[]
  chosenId: string | null
  onChoose: (classId: string) => void
  now: Date
  // Summaries the student hasn't opened yet.
  newSummaries: number
  // Called after any choice, so the phone drawer can close.
  onDone?: () => void
}

/** The navigation. */
export function HomeNav({
  classes,
  courses,
  chosenId,
  onChoose,
  now,
  newSummaries,
  onDone,
}: Readonly<HomeNavProps>) {
  // Only sign-out is needed from the auth context.
  const { signOut } = useAuth()
  // Today's classes and the ones before today (most recent first).
  const groups = groupClassesByDay(classes, now)
  const earlier = groups.past.slice(0, EARLIER_LIMIT)

  /** One class row: choosing it files the next notes under it. */
  function classRow(session: ClassSession) {
    const course = courses.find((c) => c.id === session.courseId)
    return (
      <li key={session.id}>
        <button
          type="button"
          aria-pressed={session.id === chosenId}
          onClick={() => {
            onChoose(session.id)
            onDone?.()
          }}
          className={cn(ROW, session.id === chosenId && 'bg-accent')}
        >
          {course?.code} · {session.title}
        </button>
      </li>
    )
  }

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 overflow-y-auto p-3.5">
      {/* The logo. */}
      <div className="px-1.5 pb-3">
        <Logo />
      </div>
      <h2 className="px-2 pt-1.5 pb-1 text-xs tracking-wider text-muted-foreground uppercase">
        Today
      </h2>
      {groups.today.length > 0 ? (
        <ul>{groups.today.map(classRow)}</ul>
      ) : (
        <p className="px-3 py-2 text-sm text-muted-foreground">No classes today.</p>
      )}
      {earlier.length > 0 && (
        <>
          <h2 className="px-2 pt-3.5 pb-1 text-xs tracking-wider text-muted-foreground uppercase">
            Earlier
          </h2>
          <ul>{earlier.map(classRow)}</ul>
        </>
      )}
      <div className="my-3 h-px bg-border" />
      <Link to={`${ROUTES.notes}?tab=summaries`} className={ROW}>
        Summaries
        {newSummaries > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs text-primary-foreground">
            {newSummaries} new
          </span>
        )}
      </Link>
      <Link to={ROUTES.notes} className={ROW}>
        All notes
      </Link>
      <Link to={ROUTES.courses} className={ROW}>
        Courses
      </Link>
      <Link to={ROUTES.classes} className={ROW}>
        Classes
      </Link>
      <Link to={ROUTES.settings} className={ROW}>
        Settings
      </Link>
      {/* No navigation here: the route guard sends the student to the landing page. */}
      <button
        type="button"
        onClick={() => void signOut()}
        className={cn(ROW, 'mt-auto justify-start gap-2 text-muted-foreground')}
      >
        <LogOut aria-hidden="true" className="size-4" />
        Sign out
      </button>
    </nav>
  )
}
