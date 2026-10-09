/**
 * One class (admin REQUIREMENTS section 13): course, teacher, time, counts, the AI job history
 * and the summary timeline, with edit and archive. Only counts are shown for notes, never their
 * content. An archived class shows a notice and offers no changes.
 */

// The back arrow.
import { ArrowLeft } from 'lucide-react'
// Children type.
import type { ReactNode } from 'react'
// Client-side links and the ID in the address.
import { Link, useParams } from 'react-router'

// Badges, buttons, the tab title and loading blocks.
import { Badge } from '@conote/ui/badge'
import { Button } from '@conote/ui/button'
import { PageTitle } from '@conote/ui/common/PageTitle'
import { Skeleton } from '@conote/ui/skeleton'

// The summary label.
import { SummaryStatusBadge } from '@/components/classes/SummaryStatusBadge'
// Load-failure panel.
import { ErrorState } from '@/components/common/ErrorState'
// The actions shared with the list.
import { useClassActions } from '@/features/classes/useClassActions'
// The details.
import { useClass } from '@/hooks/useClasses'
// Wording for AI job statuses and summary stages.
import { aiJobStatusLabel } from '@/lib/aiJobStatus'
import { formatTime, formatTimeRange } from '@/lib/classTimes'
// Dates.
import { formatDate } from '@/lib/format'
// Addresses.
import { ADMIN_ROUTES, routeTo } from '@/lib/routes'
import { summaryStatusLabel } from '@/lib/summaryStatus'
// The details shape.
import type { ClassDetails } from '@/types/classes'

/** The link back to the list. */
function BackLink() {
  return (
    <Link
      to={ADMIN_ROUTES.classes}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to Classes
    </Link>
  )
}

/** A card with a heading. */
function Section({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section aria-label={title} className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** "10 Sept 2026 09:00" for a moment. */
function formatMoment(iso: string) {
  return `${formatDate(iso)} ${formatTime(iso)}`
}

/** The loaded page. */
function Details({ item }: Readonly<{ item: ClassDetails }>) {
  // What can be done to this class.
  const actions = useClassActions(item)

  // The facts, as terms and values.
  const rows: [string, ReactNode][] = [
    [
      'Course',
      <Link key="course" to={routeTo.course(item.courseId)} className="hover:underline">
        {item.courseCode} {item.courseTitle}
      </Link>,
    ],
    ['Class number', item.number],
    ['Teacher', item.teacher?.fullName ?? 'No teacher'],
    [
      'Date and time',
      `${formatDate(item.startsAt)} ${formatTimeRange(item.startsAt, item.endsAt)}`,
    ],
    ['Enrolled students', item.studentCount],
    ['Notes contributed', item.noteCount],
  ]

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title={item.title} />
      <BackLink />
      {/* Name, summary stage and the actions. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <SummaryStatusBadge status={item.summaryStatus} />
          {actions.isArchived && <Badge variant="outline">Archived</Badge>}
        </div>
        {!actions.isArchived && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={actions.edit}>
              Edit
            </Button>
            <Button type="button" variant="outline" onClick={actions.askArchive}>
              Archive
            </Button>
          </div>
        )}
      </div>
      {/* Why nothing can be changed. */}
      {actions.isArchived && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
          This class is archived. It can’t be changed.
        </p>
      )}
      <Section title="Details">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {rows.map(([term, value]) => (
            <div key={term}>
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {item.description && <p className="mt-4 text-sm whitespace-pre-line">{item.description}</p>}
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* The summary's stages, in order. */}
        <Section title="Summary status">
          <ol aria-label="Summary timeline" className="space-y-3 text-sm">
            {item.timeline.map((step) => (
              <li key={step.stage}>
                <span className={step.reached ? 'font-medium' : 'text-muted-foreground'}>
                  {summaryStatusLabel(step.stage)}
                </span>
                <span className="block text-muted-foreground">
                  {step.reached ? (step.at ? formatDate(step.at) : 'Reached') : 'Not reached yet'}
                </span>
              </li>
            ))}
          </ol>
        </Section>
        {/* Every try the AI pipeline has made, oldest first. */}
        <Section title="AI job history">
          {item.aiJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI jobs have run for this class.</p>
          ) : (
            <ul aria-label="AI job history" className="space-y-3 text-sm">
              {item.aiJobs.map((job) => (
                <li key={job.id}>
                  <span className="font-medium">Attempt {job.attempt}</span>{' '}
                  <Badge variant={job.status === 'failed' ? 'destructive' : 'outline'}>
                    {aiJobStatusLabel(job.status)}
                  </Badge>
                  <span className="block text-muted-foreground">
                    Queued {formatMoment(job.createdAt)}
                    {job.finishedAt ? `, finished ${formatMoment(job.finishedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      {/* The confirmation and edit form the actions open. */}
      {actions.dialogs}
    </div>
  )
}

/** Class details. */
export function ClassDetailsPage() {
  // The class's ID from the address, and its details.
  const { classId = '' } = useParams()
  const { data, isPending, error, refetch } = useClass(classId)

  // Loaded.
  if (data) return <Details item={data} />
  // Loading: the shape of the page.
  if (isPending) {
    return (
      <output aria-label="Loading class" className="block space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </output>
    )
  }
  // No such class: its own message and the way back.
  if (error.kind === 'not_found') {
    return (
      <div className="space-y-4">
        <PageTitle title="Class not found" />
        <h1 className="text-2xl font-bold">Class not found</h1>
        <p className="text-sm text-muted-foreground">
          This class doesn't exist. It may have been removed, or the link is wrong.
        </p>
        <BackLink />
      </div>
    )
  }
  // Failed: the message and a retry.
  return <ErrorState thing="this class" onRetry={() => void refetch()} />
}
