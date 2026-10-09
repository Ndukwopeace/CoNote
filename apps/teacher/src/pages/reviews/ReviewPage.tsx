/**
 * Review summary (teacher REQUIREMENTS section 9): read the draft, edit it, save it and publish
 * it. A summary that isn't the teacher's answers "not found".
 */

// Icons.
import { ArrowLeft, Hourglass } from 'lucide-react'
// Reload counter.
import { useState } from 'react'
// The address's parameter, and links.
import { Link, useParams } from 'react-router'

// The shared error type.
import { AppError } from '@conote/core/errors'
// Tab title, empty state and loading blocks.
import { EmptyState } from '@conote/ui/common/EmptyState'
import { PageTitle } from '@conote/ui/common/PageTitle'
import { Skeleton } from '@conote/ui/skeleton'

// Panels for the failure states.
import { ErrorState } from '@/components/common/ErrorState'
import { NotFoundPanel } from '@/components/common/NotFoundPanel'
// The stage label.
import { StageBadge } from '@/components/reviews/StageBadge'
// The form and the read-only view.
import { DraftEditor } from '@/features/reviews/DraftEditor'
import { PublishedDraft } from '@/features/reviews/PublishedDraft'
// The summary.
import { useReviewDetails } from '@/hooks/useReview'
// Wording and rules.
import { basedOnText } from '@/lib/format'
import { TEACHER_ROUTES, routeTo } from '@/lib/routes'
import { isEditable, stageLabel } from '@/lib/summaryStage'

/** One summary opened for review. */
export function ReviewPage() {
  // Which summary the address names.
  const { summaryId = '' } = useParams()
  // Its details.
  const { data, error, isPending, refetch } = useReviewDetails(summaryId)
  // Counts reloads, so the form restarts from the latest draft after a conflict.
  const [reloads, setReloads] = useState(0)

  // A summary that doesn't exist, or isn't this teacher's: the same answer for both.
  if (error instanceof AppError && error.kind === 'not_found') {
    return (
      <NotFoundPanel
        title="Summary not found"
        backTo={TEACHER_ROUTES.reviews}
        backLabel="Back to the review queue"
      />
    )
  }
  // Any other failure: a fixed message and a retry.
  if (error) return <ErrorState thing="this summary" onRetry={() => void refetch()} />
  // First load: blocks where the header and form will be, announced once.
  if (isPending) {
    return (
      <output aria-label="Loading the summary" className="block space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56" />
      </output>
    )
  }

  /** Loads the latest draft, then restarts the form from it. */
  async function reload() {
    await refetch()
    setReloads((count) => count + 1)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Tab title. */}
      <PageTitle title={`Review ${data.courseCode} class ${String(data.classNumber)}`} />
      {/* The way back: to the course the class belongs to. */}
      <Link
        to={routeTo.course(data.courseId)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {data.courseCode} {data.courseTitle}
      </Link>
      {/* Header: the class, its stage, and how much is behind the draft (counts, never notes). */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">
            Class {data.classNumber}: {data.classTitle}
          </h1>
          <StageBadge stage={data.status} />
        </div>
        {/* Only a drafted summary has notes behind it. */}
        {(isEditable(data.status) || data.status === 'published') && (
          <p className="text-sm text-muted-foreground">
            {basedOnText(data.notesAnalyzedCount, data.studentCount)}
          </p>
        )}
      </header>
      {/* The body for the stage. */}
      {isEditable(data.status) && <DraftEditor key={reloads} details={data} onReload={reload} />}
      {data.status === 'published' && <PublishedDraft details={data} />}
      {!isEditable(data.status) && data.status !== 'published' && (
        <EmptyState icon={Hourglass} title={`${stageLabel(data.status)}.`}>
          There is nothing to review yet. It will appear in your review queue when the draft is
          ready.
        </EmptyState>
      )}
    </div>
  )
}
