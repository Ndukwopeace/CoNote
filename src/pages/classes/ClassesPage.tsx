/**
 * All classes, at /classes (FR-CLS-6): every class across the student's courses, grouped into
 * Today, Upcoming and Past. Opened from the dashboard's "View all"; not in the navigation.
 */

// Icons.
import { ArrowLeft, CalendarDays } from 'lucide-react'
// Client-side link.
import { Link } from 'react-router'

// One class row.
import { ClassListItem } from '@/components/common/ClassListItem'
// Empty state.
import { EmptyState } from '@/components/common/EmptyState'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Tab title.
import { PageTitle } from '@/components/common/PageTitle'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// Data hooks.
import { useMyClasses } from '@/hooks/useClasses'
import { useMyCourses } from '@/hooks/useCourses'
import { useNow } from '@/hooks/useNow'
// Class rules.
import { getClassStatus, groupClassesByDay } from '@/lib/classes'
// Route constants and builders.
import { ROUTES, routeTo } from '@/lib/routes'
// Shapes used below.
import type { ClassSession, Course } from '@/types/domain'

/** All classes. */
export function ClassesPage() {
  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Tab title. */}
      <PageTitle title="All classes" />
      {/* Back to Home, where this page is opened from. */}
      <Link
        to={ROUTES.dashboard}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Home
      </Link>
      {/* Page heading. */}
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">All classes</h1>
      {/* The groups, with their states. */}
      <ClassGroups />
    </div>
  )
}

/** The three groups, or the loading, error or empty state. */
function ClassGroups() {
  // Every class, and the courses for their codes.
  const classes = useMyClasses()
  const courses = useMyCourses()
  // The clock: groups and badges follow it.
  const now = useNow()

  // Failed.
  const failed = classes.error ?? courses.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void classes.refetch()
          void courses.refetch()
        }}
      />
    )
  }
  // Loading.
  if (!classes.data || !courses.data) return <ListSkeleton rows={5} />
  // Nothing scheduled.
  if (classes.data.length === 0) {
    return (
      <EmptyState icon={CalendarDays} title="No classes yet">
        Your classes appear here once you&apos;re enrolled and your teachers schedule them.
      </EmptyState>
    )
  }

  // Course by ID, for codes.
  const courseById = new Map(courses.data.map((course) => [course.id, course]))
  // Today, later, and before today (most recent first).
  const groups = groupClassesByDay(classes.data, now)

  return (
    <div className="space-y-6">
      <ClassGroup
        id="today"
        title="Today"
        empty="No classes today."
        sessions={groups.today}
        courseById={courseById}
        now={now}
      />
      <ClassGroup
        id="upcoming"
        title="Upcoming"
        empty="No upcoming classes."
        sessions={groups.upcoming}
        courseById={courseById}
        now={now}
      />
      <ClassGroup
        id="past"
        title="Past"
        empty="No past classes."
        sessions={groups.past}
        courseById={courseById}
        now={now}
      />
    </div>
  )
}

/** One named group: a heading and its classes, or a line saying there are none. */
function ClassGroup({
  id,
  title,
  empty,
  sessions,
  courseById,
  now,
}: Readonly<{
  id: string
  title: string
  empty: string
  sessions: ClassSession[]
  courseById: ReadonlyMap<string, Course>
  now: Date
}>) {
  // The heading's ID, which names the region.
  const headingId = `classes-${id}`
  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card p-4">
      {/* Group heading; it names the region. */}
      <h2 id={headingId} className="mb-2 text-lg font-semibold">
        {title}
      </h2>
      {sessions.length === 0 ? (
        // An empty group says so, rather than disappearing.
        <p className="py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="-mx-3">
          {sessions.map((session) => {
            // The class's course.
            const course = courseById.get(session.courseId)
            return (
              <ClassListItem
                key={session.id}
                to={routeTo.class(session.courseId, session.id)}
                courseId={session.courseId}
                courseCode={course ? `${course.code} · ${course.title}` : ''}
                number={session.number}
                title={session.title}
                startsAt={session.startsAt}
                endsAt={session.endsAt}
                status={getClassStatus(session, now)}
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}
