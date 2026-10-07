/**
 * The summary view, at /courses/:courseId/classes/:classId/summary (FR-SUM-1 to FR-SUM-6): the
 * teacher-approved summary in two tabs, with the Ask CoNote AI panel alongside.
 */

// Icons.
import { ArrowLeft, BadgeCheck, CheckCircle2, HelpCircle, Lightbulb } from 'lucide-react'
// Marks a summary as viewed once.
import { useEffect, useRef } from 'react'
// Route parameters, links and the query string.
import { Link, useParams, useSearchParams } from 'react-router'

// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Missing-summary panel.
import { NotFoundPanel } from '@/components/common/NotFoundPanel'
// Tab title.
import { PageTitle } from '@/components/common/PageTitle'
// Loading placeholders.
import { HeaderSkeleton, ListSkeleton } from '@/components/common/Skeletons'
// Status label.
import { StatusBadge } from '@/components/common/StatusBadge'
// Summary stage card.
import { SummaryStateCard } from '@/components/common/SummaryStateCard'
// Tabs.
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@conote/ui/tabs'
// The summary's Ask AI panel.
import { SummaryAskAi } from '@/features/ai/SummaryAskAi'
// Data hooks.
import { useClass } from '@/hooks/useClasses'
import { useCourse } from '@/hooks/useCourses'
import { useClassSummary, useMarkSummaryViewed } from '@/hooks/useSummaries'
// Date wording.
import { formatClassDate } from '@/lib/dates'
// "41 student notes".
import { countOf } from '@/lib/plural'
// Route constants and builders.
import { ROUTES, routeTo } from '@/lib/routes'
// Reads ?tab= safely.
import { parseTab } from '@/lib/tabs'
// Shapes.
import type { ClassSession, Course, Summary } from '@/types/domain'

/** The tabs; the first is the default. */
const SUMMARY_TABS: ['summary', 'topics'] = ['summary', 'topics']

/** The summary page. */
export function SummaryPage() {
  // IDs from the address.
  const { courseId = '', classId = '' } = useParams()
  // The course and class.
  const course = useCourse(courseId)
  const session = useClass(classId)
  // SECURITY: the summary is only requested once the class is known to be published and to
  // belong to this course, so a draft is never asked for (FR-SUM-6).
  const published =
    session.data?.summaryStatus === 'published' && session.data.courseId === courseId
  const summary = useClassSummary(classId, { enabled: published })

  /** The not-found panel; back to the course when it exists. */
  const notFound = (
    <NotFoundPanel
      title="Summary not found"
      backTo={course.data ? routeTo.course(course.data.id) : ROUTES.courses}
      backLabel={course.data ? `Back to ${course.data.title}` : 'Back to My Courses'}
    />
  )

  // A class opened under another course's address is treated as missing.
  if (session.data && session.data.courseId !== courseId) return notFound
  // Failed, or missing.
  const failed = course.error ?? session.error ?? summary.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void course.refetch()
          void session.refetch()
          if (published) void summary.refetch()
        }}
        notFound={notFound}
      />
    )
  }
  // Loading the course and class.
  if (!course.data || !session.data) return <SummarySkeleton />
  // Not published: the stage only, never content (FR-SUM-6).
  if (!published) {
    return (
      <div className="w-full max-w-5xl space-y-6">
        <PageTitle title={`${session.data.title} summary`} />
        <BackToClass course={course.data} session={session.data} />
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{session.data.title}</h1>
        <SummaryStateCard status={session.data.summaryStatus} />
      </div>
    )
  }
  // Loading the summary.
  if (!summary.data) return <SummarySkeleton />

  // Loaded.
  return <SummaryView course={course.data} session={session.data} summary={summary.data} />
}

/** Header and list shapes while loading. */
function SummarySkeleton() {
  return (
    <div className="w-full max-w-5xl space-y-6">
      <HeaderSkeleton />
      <ListSkeleton rows={3} announce={false} />
    </div>
  )
}

/** The back link to the class page. */
function BackToClass({ course, session }: Readonly<{ course: Course; session: ClassSession }>) {
  return (
    <Link
      to={routeTo.class(course.id, session.id)}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {session.title}
    </Link>
  )
}

/** The published summary, with the Ask AI panel. */
function SummaryView({
  course,
  session,
  summary,
}: Readonly<{ course: Course; session: ClassSession; summary: Summary }>) {
  // The address's query string.
  const [params, setParams] = useSearchParams()
  // SECURITY: only known tab names are used (see parseTab).
  const tab = parseTab(params.get('tab'), SUMMARY_TABS)
  // Marks the summary as viewed.
  const markViewed = useMarkSummaryViewed()
  // The summary already marked on this visit, so it is marked once.
  const marked = useRef<string | null>(null)

  // Opening a summary marks it as viewed (FR-SUM-5). Failure only means it stays "new".
  useEffect(() => {
    if (summary.viewedByMe || marked.current === summary.id) return
    marked.current = summary.id
    markViewed.mutate(summary.id)
  }, [summary.id, summary.viewedByMe, markViewed])

  return (
    // Two columns on desktop: the summary, and the Ask AI panel (FR-SUM-4).
    <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {/* Tab title. */}
        <PageTitle title={`${session.title} summary`} />
        <BackToClass course={course} session={session} />

        {/* Header (FR-SUM-1), a region named by the class title. */}
        <section
          aria-labelledby="summary-title"
          className="space-y-2 rounded-xl border bg-card p-4 md:p-6"
        >
          <p className="text-sm font-semibold text-muted-foreground">
            {course.code} · {course.title}
          </p>
          <h1 id="summary-title" className="text-2xl font-bold tracking-tight md:text-3xl">
            {session.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <StatusBadge status="published" />
            <span>{formatClassDate(summary.publishedAt)}</span>
            <span>Reviewed by {summary.reviewedBy.fullName}</span>
            <span>Based on {countOf(summary.notesAnalyzedCount, 'student note')}</span>
          </div>
        </section>

        {/* FR-SUM-3: where the text came from. */}
        <p className="flex items-start gap-2 rounded-lg bg-primary-light px-4 py-3 text-sm text-accent-foreground">
          <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          AI-generated from class notes, reviewed and approved by your teacher.
        </p>

        {/* The two tabs (FR-SUM-2), kept in ?tab=. */}
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setParams({ tab: parseTab(value, SUMMARY_TABS) }, { replace: true })
          }}
        >
          <TabsList aria-label="Summary sections">
            <TabsTrigger value="summary">AI Summary</TabsTrigger>
            <TabsTrigger value="topics">Key Topics</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="space-y-6">
            <AiSummary summary={summary} />
          </TabsContent>
          <TabsContent value="topics">
            <KeyTopics summary={summary} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Ask CoNote AI about this summary (FR-SUM-4). */}
      <SummaryAskAi courseId={course.id} classId={session.id} />
    </div>
  )
}

/** The AI Summary tab: overview, key concepts, areas of confusion. All plain text. */
function AiSummary({ summary }: Readonly<{ summary: Summary }>) {
  return (
    <>
      {/* Overview. */}
      <p className="rounded-xl border bg-card p-4 leading-relaxed md:p-6">{summary.overview}</p>

      {/* Key Concepts. */}
      <section aria-labelledby="concepts-heading" className="space-y-3">
        <h2 id="concepts-heading" className="text-lg font-semibold">
          Key Concepts
        </h2>
        <ul className="space-y-3">
          {summary.keyConcepts.map((concept) => (
            <li key={concept.id} className="flex gap-3 rounded-xl border bg-card p-4">
              <Lightbulb aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">{concept.title}</p>
                <p className="text-sm text-muted-foreground">{concept.explanation}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Common Areas of Confusion, each with the approved clarification. */}
      <section aria-labelledby="confusion-heading" className="space-y-3">
        <h2 id="confusion-heading" className="text-lg font-semibold">
          Common Areas of Confusion
        </h2>
        <ul className="space-y-3">
          {summary.confusionAreas.map((area) => (
            <li key={area.id} className="space-y-2 rounded-xl border bg-card p-4">
              <p className="flex gap-2 font-semibold">
                <HelpCircle
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-warning-strong"
                />
                {area.issue}
              </p>
              <p className="flex gap-2 text-sm">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-success-strong"
                />
                {area.clarification}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

/** The Key Topics tab: a chip grid, each with its description when there is one. */
function KeyTopics({ summary }: Readonly<{ summary: Summary }>) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {summary.keyTopics.map((topic) => (
        <li key={topic.id} className="rounded-xl border bg-card p-4">
          <span className="block font-semibold">{topic.name}</span>
          {topic.description && (
            <span className="block text-sm text-muted-foreground">{topic.description}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
