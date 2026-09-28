/**
 * The Class page, at /courses/:courseId/classes/:classId (FR-CLS-1 to FR-CLS-5). A header, three
 * tabs chosen with ?tab=overview|notes|summary, and Previous/Next links.
 */

// Icons.
import { ArrowLeft, ChevronLeft, ChevronRight, NotebookPen, Plus } from 'lucide-react'
// Route parameters, links and the query string.
import { Link, useParams, useSearchParams } from 'react-router'

// Empty state.
import { EmptyState } from '@/components/common/EmptyState'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Missing-class panel.
import { NotFoundPanel } from '@/components/common/NotFoundPanel'
// Tab title.
import { PageTitle } from '@/components/common/PageTitle'
// The FR-CLS-3 banner.
import { PrivacyBanner } from '@/components/common/PrivacyBanner'
// The notes list.
import { NoteList } from '@/components/common/NoteList'
// Loading placeholders.
import { HeaderSkeleton, ListSkeleton } from '@/components/common/Skeletons'
// The status label.
import { StatusBadge } from '@/components/common/StatusBadge'
// Summary stage card.
import { SummaryStateCard } from '@/components/common/SummaryStateCard'
// Link styled as a button.
import { buttonVariants } from '@/components/ui/button'
// Tabs.
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// Data hooks.
import { useClass, useCourseClasses } from '@/hooks/useClasses'
import { useCourse } from '@/hooks/useCourses'
import { useMyNotes } from '@/hooks/useNotes'
import { useNow } from '@/hooks/useNow'
// Class rules.
import { adjacentClasses, getClassStatus } from '@/lib/classes'
// Date wording.
import { formatClassDate, formatClassTime } from '@/lib/dates'
// Route constants and builders.
import { ROUTES, routeTo } from '@/lib/routes'
// Reads ?tab= safely.
import { parseTab } from '@/lib/tabs'
// Shapes used below.
import type { ClassSession, Course } from '@/types/domain'

/** The tabs, in display order; the first is the default. */
const CLASS_TABS: ['overview', 'notes', 'summary'] = ['overview', 'notes', 'summary']

/** The Class page. */
export function ClassPage() {
  // IDs from the address; the route always has both.
  const { courseId = '', classId = '' } = useParams()
  // The course, the class and the course's other classes (for Previous/Next).
  const course = useCourse(courseId)
  const session = useClass(classId)
  const siblings = useCourseClasses(courseId)

  /** The not-found panel; back to the course when it exists, otherwise to My Courses. */
  const notFound = course.data ? (
    <NotFoundPanel
      title="Class not found"
      backTo={routeTo.course(course.data.id)}
      backLabel={`Back to ${course.data.title}`}
    />
  ) : (
    <NotFoundPanel title="Class not found" backTo={ROUTES.courses} backLabel="Back to My Courses" />
  )

  // SECURITY: a real class opened under another course's address is treated as missing, so a
  // hand-edited URL can't show a class under the wrong course (and, later, the wrong course's
  // permissions).
  if (session.data && session.data.courseId !== courseId) return notFound

  // The first failure among the three reads.
  const failed = course.error ?? session.error ?? siblings.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          // Repeat all three; the ones that worked come from the cache.
          void course.refetch()
          void session.refetch()
          void siblings.refetch()
        }}
        notFound={notFound}
      />
    )
  }
  // Loading.
  if (!course.data || !session.data || !siblings.data) {
    return (
      <div className="w-full max-w-5xl space-y-6">
        <HeaderSkeleton />
        <ListSkeleton rows={2} announce={false} />
      </div>
    )
  }

  // Loaded.
  return <ClassDetails course={course.data} session={session.data} siblings={siblings.data} />
}

/** The loaded page. */
function ClassDetails({
  course,
  session,
  siblings,
}: Readonly<{ course: Course; session: ClassSession; siblings: ClassSession[] }>) {
  // The address's query string.
  const [params, setParams] = useSearchParams()
  // SECURITY: only known tab names are used (see parseTab).
  const tab = parseTab(params.get('tab'), CLASS_TABS)
  // The clock, so the badge turns Live and then Completed while the page is open.
  const now = useNow()
  // The neighbouring classes.
  const { previous, next } = adjacentClasses(siblings, session.id)

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Tab title: class and course code. */}
      <PageTitle title={`${session.title} · ${course.code}`} />
      {/* Back to the course. */}
      <Link
        to={routeTo.course(course.id)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {course.title}
      </Link>

      {/* Header (FR-CLS-1), a region named by the class title. */}
      <section
        aria-labelledby="class-title"
        className="space-y-2 rounded-xl border bg-card p-4 md:p-6"
      >
        {/* Course code and title. */}
        <p className="text-sm font-semibold text-muted-foreground">
          {course.code} · {course.title}
        </p>
        {/* Class number and status. */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Class {session.number}</span>
          <StatusBadge status={getClassStatus(session, now)} />
        </div>
        {/* The page heading. */}
        <h1 id="class-title" className="text-2xl font-bold tracking-tight md:text-3xl">
          {session.title}
        </h1>
        {/* Date and time. */}
        <p className="text-sm text-muted-foreground">
          {formatClassDate(session.startsAt)} · {formatClassTime(session.startsAt, session.endsAt)}
        </p>
      </section>

      {/* The three tabs (FR-CLS-2), kept in ?tab= like Course Details. */}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setParams({ tab: parseTab(value, CLASS_TABS) }, { replace: true })
        }}
      >
        <TabsList aria-label="Class sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>
        {/* Overview: description and summary stage. */}
        <TabsContent value="overview" className="space-y-4">
          <p className="rounded-xl border bg-card p-4 md:p-6">
            {session.description ?? 'No description for this class.'}
          </p>
          <SummaryCard course={course} session={session} />
        </TabsContent>
        {/* The student's own notes for this class. */}
        <TabsContent value="notes">
          <NotesTab session={session} />
        </TabsContent>
        {/* The summary, or its stage. */}
        <TabsContent value="summary">
          <SummaryCard course={course} session={session} />
        </TabsContent>
      </Tabs>

      {/* Previous and Next (FR-CLS-5); each is left out at the ends of the course. */}
      <nav
        aria-label="Other classes"
        className="flex flex-col gap-3 sm:flex-row sm:justify-between"
      >
        {previous ? (
          <Link
            to={routeTo.class(course.id, previous.id)}
            className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-[48%]"
          >
            <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
            <span>
              <span className="block text-xs text-muted-foreground">Previous class</span>{' '}
              <span className="block font-medium">{previous.title}</span>
            </span>
          </Link>
        ) : (
          // Keeps Next on the right when there is no Previous.
          <span />
        )}
        {next && (
          <Link
            to={routeTo.class(course.id, next.id)}
            className="flex items-center justify-end gap-2 rounded-lg border bg-card p-3 text-right text-sm outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-[48%]"
          >
            <span>
              <span className="block text-xs text-muted-foreground">Next class</span>{' '}
              <span className="block font-medium">{next.title}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        )}
      </nav>
    </div>
  )
}

/**
 * The summary stage card. Once published it links to the summary view.
 * SECURITY: nothing but the stage is shown before publication, so draft content can't reach the
 * student from this page (section 4).
 */
function SummaryCard({ course, session }: Readonly<{ course: Course; session: ClassSession }>) {
  return (
    <SummaryStateCard
      status={session.summaryStatus}
      action={
        // Only a published summary has something to open.
        session.summaryStatus === 'published' && (
          <Link
            to={routeTo.summary(course.id, session.id)}
            className={buttonVariants({ size: 'sm' })}
          >
            Read the summary
          </Link>
        )
      }
    />
  )
}

/** Notes: privacy banner, Add Note, then the list or the empty state. */
function NotesTab({ session }: Readonly<{ session: ClassSession }>) {
  return (
    <div className="space-y-4">
      {/* Always shown (FR-CLS-3). */}
      <PrivacyBanner />
      {/* Add Note, opening the editor for this class (the editor arrives in M4). */}
      <div className="flex justify-end">
        <Link to={routeTo.newNote(session.id)} className={buttonVariants()}>
          <Plus aria-hidden="true" />
          Add Note
        </Link>
      </div>
      {/* The list with its states. */}
      <ClassNotes classId={session.id} />
    </div>
  )
}

/** The class's notes, or their loading, error or empty state. */
function ClassNotes({ classId }: Readonly<{ classId: string }>) {
  // The student's notes for this class.
  const notes = useMyNotes({ classId })
  // The clock, for "25 min ago".
  const now = useNow()

  // Failed.
  if (notes.isError) return <LoadError error={notes.error} onRetry={() => void notes.refetch()} />
  // Loading.
  if (!notes.data) return <ListSkeleton rows={2} />
  // None yet (FR-CLS-4 wording).
  if (notes.data.length === 0) {
    return (
      <EmptyState icon={NotebookPen} title="No notes yet">
        Start taking notes for this class. Your notes will be private and used to help generate
        summaries.
      </EmptyState>
    )
  }
  // The notes.
  return <NoteList notes={notes.data} now={now} />
}
