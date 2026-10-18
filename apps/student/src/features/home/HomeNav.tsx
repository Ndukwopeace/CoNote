/**
 * Home's navigation (D103, D104): the shared navigation with Home's own section above the links,
 * the classes of today and earlier (choosing one files the next notes under it).
 */

// The navigation every page shares, and the look of its rows.
import { AppNav, NAV_ROW } from '@/layouts/AppNav'
// Class rules.
import { groupClassesByDay } from '@/lib/classes'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shapes.
import type { ClassSession, Course } from '@/types/domain'

/** How many earlier classes the navigation lists. */
const EARLIER_LIMIT = 4

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
          className={cn(NAV_ROW, session.id === chosenId && 'bg-accent')}
        >
          {course?.code} · {session.title}
        </button>
      </li>
    )
  }

  return (
    // The shared navigation, with Home's classes above the links.
    <AppNav newSummaries={newSummaries} {...(onDone ? { onDone } : {})}>
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
    </AppNav>
  )
}
