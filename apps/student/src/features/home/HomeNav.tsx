/**
 * Home's navigation (D103, D104): the shared navigation with Home's own section above the links,
 * the classes of today and the two days before under "Today", "Yesterday" and the date (choosing one
 * files the next notes under it; one that has not started cannot be chosen yet, D108).
 */

// The navigation every page shares, and the look of its rows.
import { AppNav, NAV_ROW } from '@/layouts/AppNav'
// Class rules.
import { classesByDay, hasClassStarted } from '@/lib/classes'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shapes.
import type { ClassSession, Course } from '@/types/domain'

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
  // Today and the two days before, grouped by day.
  const days = classesByDay(classes, now)

  /** One class row: choosing it files the next notes under it. */
  function classRow(session: ClassSession) {
    const course = courses.find((c) => c.id === session.courseId)
    return (
      <li key={session.id}>
        <button
          type="button"
          aria-pressed={session.id === chosenId}
          disabled={!hasClassStarted(session, now)}
          onClick={() => {
            onChoose(session.id)
            onDone?.()
          }}
          className={cn(
            NAV_ROW,
            session.id === chosenId && 'bg-accent',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {course?.code} · {session.title}
        </button>
      </li>
    )
  }

  return (
    // The shared navigation, with Home's classes above the links.
    <AppNav newSummaries={newSummaries} {...(onDone ? { onDone } : {})}>
      {days.length === 0 && (
        <p className="px-3 py-2 text-sm text-muted-foreground">No classes in the last 3 days.</p>
      )}
      {days.map((day, index) => (
        <div key={day.label}>
          {/* The day: Today, Yesterday, or the date. */}
          <h2
            className={cn(
              'px-2 pb-1 text-xs tracking-wider text-muted-foreground uppercase',
              index === 0 ? 'pt-1.5' : 'pt-3.5',
            )}
          >
            {day.label}
          </h2>
          <ul>{day.classes.map(classRow)}</ul>
        </div>
      ))}
    </AppNav>
  )
}
