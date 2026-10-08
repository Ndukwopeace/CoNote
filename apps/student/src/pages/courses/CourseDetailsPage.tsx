/**
 * Course Details, at /courses/:courseId (FR-CRS-3, FR-CRS-4). A header, then four tabs chosen
 * with ?tab=overview|classes|notes|summaries.
 */

// Icons.
import { ArrowLeft, CalendarDays, FileCheck2, NotebookPen, Users } from 'lucide-react'
// Route parameters, links and the query string.
import { Link, useParams, useSearchParams } from 'react-router'

// One class row.
import { ClassListItem } from '@/components/common/ClassListItem'
// Empty states.
import { EmptyState } from '@conote/ui/common/EmptyState'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Missing-course panel.
import { NotFoundPanel } from '@/components/common/NotFoundPanel'
// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// The notes list.
import { NoteList } from '@/components/common/NoteList'
// The summaries list.
import { SummaryList } from '@/components/common/SummaryList'
// Loading placeholders.
import { HeaderSkeleton, ListSkeleton } from '@/components/common/Skeletons'
// The status label.
import { StatusBadge } from '@/components/common/StatusBadge'
// The course icon.
import { CourseIcon } from '@/components/common/CourseIcon'
// Teacher avatar.
import { Avatar, AvatarFallback } from '@conote/ui/avatar'
// Tabs.
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@conote/ui/tabs'
// Data hooks.
import { useCourseClasses } from '@/hooks/useClasses'
import { useCourse } from '@/hooks/useCourses'
import { useMyNotes } from '@/hooks/useNotes'
import { useNow } from '@/hooks/useNow'
import { usePublishedSummaries } from '@/hooks/useSummaries'
// Class status from the clock.
import { getClassStatus } from '@/lib/classes'
// Teacher initials.
import { initials } from '@conote/core/initials'
// "4 classes", "1 note".
import { countOf } from '@/lib/plural'
// Route constants and builders.
import { ROUTES, routeTo } from '@/lib/routes'
// Reads ?tab= safely.
import { parseTab } from '@/lib/tabs'
// Shapes used below.
import type { Course } from '@/types/domain'

/** The tabs, in display order; the first is the default. */
const COURSE_TABS: ['overview', 'classes', 'notes', 'summaries'] = [
  'overview',
  'classes',
  'notes',
  'summaries',
]

/** Course Details. */
export function CourseDetailsPage() {
  // The course ID from the address; the route always has one.
  const { courseId = '' } = useParams()
  // The course.
  const course = useCourse(courseId)

  // Failed, or no such course.
  if (course.isError) {
    return (
      <LoadError
        error={course.error}
        onRetry={() => void course.refetch()}
        notFound={
          <NotFoundPanel
            title="Course not found"
            backTo={ROUTES.courses}
            backLabel="Back to My Courses"
          />
        }
      />
    )
  }
  // Loading: a header shape and a list shape.
  if (!course.data) {
    return (
      <div className="w-full max-w-5xl space-y-6">
        <HeaderSkeleton />
        <ListSkeleton rows={3} announce={false} />
      </div>
    )
  }

  // Loaded.
  return <CourseDetails course={course.data} />
}

/** The loaded page: header and tabs. */
function CourseDetails({ course }: Readonly<{ course: Course }>) {
  // The address's query string.
  const [params, setParams] = useSearchParams()
  // SECURITY: only known tab names are used (see parseTab).
  const tab = parseTab(params.get('tab'), COURSE_TABS)

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Tab title: the course code and title. */}
      <PageTitle title={`${course.code} ${course.title}`} />
      {/* Back to the list. */}
      <Link
        to={ROUTES.courses}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        My Courses
      </Link>

      {/* Header (FR-CRS-3), a region named by the course title. */}
      <section
        aria-labelledby="course-title"
        className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start md:p-6"
      >
        {/* Course colour. */}
        <CourseIcon courseId={course.id} className="size-12" />
        <div className="min-w-0 flex-1 space-y-2">
          {/* Code and status. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">{course.code}</span>
            <StatusBadge status={course.status} />
          </div>
          {/* The page heading. */}
          <h1 id="course-title" className="text-2xl font-bold tracking-tight md:text-3xl">
            {course.title}
          </h1>
          {/* Teacher, students and classes. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              {/* Teacher avatar; initials, as there is no picture yet. Decorative next to the name. */}
              <Avatar aria-hidden="true" className="size-7">
                <AvatarFallback className="text-xs">
                  {initials(course.teacher.fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{course.teacher.fullName}</span>
            </span>{' '}
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden="true" className="size-4" />
              {countOf(course.studentCount, 'student')}
            </span>{' '}
            <span className="inline-flex items-center gap-1">
              <CalendarDays aria-hidden="true" className="size-4" />
              {countOf(course.classCount, 'class', 'classes')}
            </span>
          </div>
        </div>
      </section>

      {/* The four tabs (FR-CRS-4). The choice is kept in ?tab=, replacing the history entry so
          Back leaves the page instead of stepping through tabs. */}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setParams({ tab: parseTab(value, COURSE_TABS) }, { replace: true })
        }}
      >
        <TabsList aria-label="Course sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="summaries">Summaries</TabsTrigger>
        </TabsList>
        {/* Overview: description, teacher and schedule. */}
        <TabsContent value="overview">
          <OverviewTab course={course} />
        </TabsContent>
        {/* Classes, in order. */}
        <TabsContent value="classes">
          <ClassesTab course={course} />
        </TabsContent>
        {/* The student's notes for this course. */}
        <TabsContent value="notes">
          <NotesTab courseId={course.id} />
        </TabsContent>
        {/* Published summaries for this course. */}
        <TabsContent value="summaries">
          <SummariesTab courseId={course.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Overview: what the course is about, who teaches it and when. */
function OverviewTab({ course }: Readonly<{ course: Course }>) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
      {/* Description. */}
      <p>{course.description}</p>
      {/* Teacher and schedule as a small definition list. */}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Teacher</dt>
          <dd className="font-medium">{course.teacher.fullName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Schedule</dt>
          <dd className="font-medium">{course.scheduleText ?? 'Not set yet'}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Classes: numbered, with status, the student's note count and a summary marker. */
function ClassesTab({ course }: Readonly<{ course: Course }>) {
  // The course's classes.
  const classes = useCourseClasses(course.id)
  // The student's notes for this course, to count per class.
  const notes = useMyNotes({ courseId: course.id })
  // The clock, for Live/Upcoming/Completed.
  const now = useNow()

  // Failed: message and a retry of whichever read failed.
  const failed = classes.error ?? notes.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void classes.refetch()
          void notes.refetch()
        }}
      />
    )
  }
  // Loading.
  if (!classes.data || !notes.data) return <ListSkeleton rows={4} />
  // No classes scheduled.
  if (classes.data.length === 0) {
    return (
      <EmptyState icon={CalendarDays} title="No classes yet">
        Classes appear here once your teacher schedules them.
      </EmptyState>
    )
  }

  // Notes per class ID.
  const noteCounts = new Map<string, number>()
  for (const note of notes.data)
    noteCounts.set(note.classId, (noteCounts.get(note.classId) ?? 0) + 1)

  return (
    <ul className="rounded-xl border bg-card p-1">
      {classes.data.map((session) => (
        <ClassListItem
          key={session.id}
          to={routeTo.class(course.id, session.id)}
          courseId={course.id}
          number={session.number}
          title={session.title}
          startsAt={session.startsAt}
          endsAt={session.endsAt}
          status={getClassStatus(session, now)}
          details={
            // Note count, plus the marker once the summary is readable.
            <>
              {countOf(noteCounts.get(session.id) ?? 0, 'note')}
              {session.summaryStatus === 'published' && (
                <span className="font-medium text-success-strong"> · Summary available</span>
              )}
            </>
          }
        />
      ))}
    </ul>
  )
}

/** Notes: the student's own notes for this course, newest first. */
function NotesTab({ courseId }: Readonly<{ courseId: string }>) {
  // The notes.
  const notes = useMyNotes({ courseId })
  // The clock, for "2 days ago".
  const now = useNow()

  // Failed.
  if (notes.isError) return <LoadError error={notes.error} onRetry={() => void notes.refetch()} />
  // Loading.
  if (!notes.data) return <ListSkeleton rows={3} />
  // None yet.
  if (notes.data.length === 0) {
    return (
      <EmptyState icon={NotebookPen} title="No notes yet">
        Open a class to start taking notes. Your notes are private.
      </EmptyState>
    )
  }

  // The notes.
  return <NoteList notes={notes.data} now={now} />
}

/** Summaries: this course's published summaries, newest first. */
function SummariesTab({ courseId }: Readonly<{ courseId: string }>) {
  // Published summaries.
  const summaries = usePublishedSummaries({ courseId })
  // Class titles, since a summary only carries the class ID.
  const classes = useCourseClasses(courseId)
  // The clock, for "2 hours ago".
  const now = useNow()

  // Failed.
  const failed = summaries.error ?? classes.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void summaries.refetch()
          void classes.refetch()
        }}
      />
    )
  }
  // Loading.
  if (!summaries.data || !classes.data) return <ListSkeleton rows={2} />
  // None published yet.
  if (summaries.data.length === 0) {
    return (
      <EmptyState icon={FileCheck2} title="No summaries yet">
        Summaries appear here once your teacher approves them.
      </EmptyState>
    )
  }

  // Class by ID, for titles.
  const classById = new Map(classes.data.map((session) => [session.id, session]))
  // The summaries.
  return <SummaryList summaries={summaries.data} classById={classById} now={now} />
}
