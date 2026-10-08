/**
 * Home, the student's dashboard, at /dashboard (FR-DSH-1 to FR-DSH-6): greeting, four stat
 * cards, the next classes, recent activity and the Ask CoNote AI card.
 */

// Icons for the stat cards, activity types and the AI card.
import {
  BookOpen,
  CalendarDays,
  FileCheck2,
  GraduationCap,
  NotebookPen,
  Sparkles,
} from 'lucide-react'
// Client-side links.
import { Link } from 'react-router'

// One class row.
import { ClassListItem } from '@/components/common/ClassListItem'
// Enrolment empty state.
import { EmptyState } from '@/components/common/EmptyState'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// The notification type icon.
import { NotificationTypeIcon } from '@/components/common/NotificationTypeIcon'
// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Loading placeholders.
import { CardGridSkeleton, ListSkeleton } from '@/components/common/Skeletons'
// Stat card.
import { StatCard } from '@conote/ui/common/StatCard'
// Sign-in state, for the name.
import { useAuth } from '@/features/auth/useAuth'
// Data hooks.
import { useMyClasses } from '@/hooks/useClasses'
import { useMyCourses } from '@/hooks/useCourses'
import { useMyNotes } from '@/hooks/useNotes'
import { useNotifications } from '@/hooks/useNotifications'
import { useNow } from '@/hooks/useNow'
import { usePublishedSummaries } from '@/hooks/useSummaries'
// Class rules: status, today's classes and the next ones.
import { getClassStatus, groupClassesByDay, upcomingClasses } from '@/lib/classes'
// Greeting and relative times.
import { formatRelativeTime, greetingFor } from '@/lib/dates'
// "Victory Okafor" → "Victory".
import { firstName } from '@conote/core/initials'
// Checks a notification link stays inside CoNote.
import { isSafeRedirect } from '@conote/core/isSafeRedirect'
// Route constants and builders.
import { ROUTES, routeTo } from '@/lib/routes'
// Shapes used below.
import type { AppNotification } from '@/types/domain'

/** How many classes the Upcoming Classes card shows (FR-DSH-3). */
const UPCOMING_LIMIT = 3
/** How many events Recent Activity shows (FR-DSH-4). */
const ACTIVITY_LIMIT = 5

/** Home. The greeting shows at once; the rest follows the data. */
export function DashboardPage() {
  // Current sign-in state.
  const auth = useAuth()
  // The current time, refreshed each minute so greetings and badges keep up.
  const now = useNow()
  // The first name when signed in (always true behind the guard), otherwise empty.
  const name = auth.status === 'signedIn' ? firstName(auth.session.user.fullName) : ''

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Tab title "Home", matching the tab bar (D35). */}
      <PageTitle title="Home" />
      <header>
        {/* The greeting is the page heading (FR-DSH-1, D39). */}
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {greetingFor(now)}, {name}
        </h1>
        {/* Subtitle. */}
        <p className="mt-1 text-muted-foreground">
          Here&apos;s what&apos;s happening with your learning.
        </p>
      </header>
      {/* Everything that needs data. */}
      <DashboardContent now={now} />
    </div>
  )
}

/** The data-driven part of Home, with its loading, error and empty states. */
function DashboardContent({ now }: Readonly<{ now: Date }>) {
  // The five reads the dashboard needs; they run in parallel.
  const courses = useMyCourses()
  const classes = useMyClasses()
  const summaries = usePublishedSummaries()
  const notes = useMyNotes()
  const notifications = useNotifications()
  // Every query, for the shared loading and error checks.
  const queries = [courses, classes, summaries, notes, notifications]

  // Any read failed: one message, and a retry that repeats only the failed reads.
  const failed = queries.find((query) => query.isError)
  if (failed?.error) {
    return (
      <LoadError
        error={failed.error}
        onRetry={() => {
          // Repeat each failed read.
          for (const query of queries) if (query.isError) void query.refetch()
        }}
      />
    )
  }

  // Still loading: shapes of the stat cards and the class list.
  if (!courses.data || !classes.data || !summaries.data || !notes.data || !notifications.data) {
    return (
      <div className="space-y-6">
        <CardGridSkeleton />
        <ListSkeleton rows={3} announce={false} />
      </div>
    )
  }

  // Not enrolled in anything: nothing else on this page would make sense (FR-DSH-6).
  if (courses.data.length === 0) {
    return (
      <EmptyState icon={GraduationCap} title="No courses yet">
        You&apos;re not enrolled in any courses yet. Your teacher or administrator will add you.
      </EmptyState>
    )
  }

  // Course code and title by ID, for the class rows.
  const courseById = new Map(courses.data.map((course) => [course.id, course]))
  // The next few classes, live ones first.
  const next = upcomingClasses(classes.data, now, UPCOMING_LIMIT)
  // Summaries the student hasn't opened yet.
  const newSummaries = summaries.data.filter((summary) => !summary.viewedByMe).length

  return (
    <div className="space-y-6">
      {/* Four stat cards: two per row on phones and tablets, four on desktop. */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          label="My Courses"
          value={courses.data.length}
          icon={BookOpen}
          to={ROUTES.courses}
        />
        <StatCard
          label="Classes Today"
          value={groupClassesByDay(classes.data, now).today.length}
          icon={CalendarDays}
          to={ROUTES.classes}
        />
        <StatCard
          label="New Summaries"
          value={newSummaries}
          icon={FileCheck2}
          to={`${ROUTES.notes}?tab=summaries`}
        />
        <StatCard
          label="Notes Created"
          value={notes.data.length}
          icon={NotebookPen}
          to={ROUTES.notes}
        />
      </div>

      {/* Two columns on desktop: classes on the left, activity and AI on the right. */}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Upcoming Classes (FR-DSH-3). aria-labelledby makes it a named region. */}
        <section aria-labelledby="upcoming-heading" className="rounded-xl border bg-card p-4">
          {/* Heading and "View all". */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="upcoming-heading" className="text-lg font-semibold">
              Upcoming Classes
            </h2>
            {/* The visible words are short; the accessible name says what "all" means. */}
            <Link
              to={ROUTES.classes}
              aria-label="View all classes"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {/* The classes, or a note that none are coming. */}
          {next.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No upcoming classes.</p>
          ) : (
            <ul className="-mx-3">
              {next.map((session) => {
                // The class's course; always present for enrolled classes.
                const course = courseById.get(session.courseId)
                return (
                  <ClassListItem
                    key={session.id}
                    to={routeTo.class(session.courseId, session.id)}
                    courseId={session.courseId}
                    courseCode={course ? `${course.code} · ${course.title}` : ''}
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

        <div className="space-y-6">
          {/* Recent Activity (FR-DSH-4, D40). */}
          <section aria-labelledby="activity-heading" className="rounded-xl border bg-card p-4">
            <h2 id="activity-heading" className="mb-2 text-lg font-semibold">
              Recent Activity
            </h2>
            {notifications.data.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-1">
                {notifications.data.slice(0, ACTIVITY_LIMIT).map((item) => (
                  <ActivityItem key={item.id} item={item} now={now} />
                ))}
              </ul>
            )}
          </section>

          {/* Ask CoNote AI (FR-DSH-5). The whole card is the link. */}
          <Link
            to={ROUTES.askAi}
            className="flex items-center gap-3 rounded-xl bg-primary p-4 text-primary-foreground outline-none hover:bg-primary-dark focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {/* Decorative icon. */}
            <Sparkles aria-hidden="true" className="size-6 shrink-0" />
            <span>
              {/* Title. */}
              <span className="block font-semibold">Ask CoNote AI</span>
              {/* What it does. */}
              <span className="block text-sm opacity-90">
                Questions about your classes, answered from approved summaries and your notes.
              </span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}

/** One Recent Activity row: icon, title and relative time; a link when it points somewhere. */
function ActivityItem({ item, now }: Readonly<{ item: AppNotification; now: Date }>) {
  // The row's content, shared by the linked and plain versions.
  const content = (
    <>
      {/* Decorative icon in a soft circle. */}
      <NotificationTypeIcon type={item.type} />
      <span className="min-w-0 flex-1">
        {/* What happened. */}
        <span className="block truncate text-sm font-medium">{item.title}</span>
        {/* When, e.g. "25 min ago". */}
        <span className="block text-xs text-muted-foreground">
          {formatRelativeTime(item.createdAt, now)}
        </span>
      </span>
    </>
  )

  return (
    <li>
      {/* SECURITY: the link comes from the server, so it is used only if it stays inside
          CoNote. This blocks a notification carrying "javascript:" or an outside address
          (phishing through an open redirect). Anything else shows as plain text. */}
      {isSafeRedirect(item.link, window.location.origin) ? (
        <Link
          to={item.link}
          className="flex items-center gap-3 rounded-lg p-2 outline-none hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-center gap-3 p-2">{content}</div>
      )}
    </li>
  )
}
