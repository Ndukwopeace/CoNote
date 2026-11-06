/**
 * The Analytics page's figures (admin REQUIREMENTS section 16, D124): users, academic activity, the
 * AI pipeline and what is not measured yet. Each loads, fails and retries on its own.
 */

// Loading blocks.
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel.
import { ErrorState } from '@conote/portal'
// The figures.
import { useAnalyticsReport } from '@/hooks/useAnalytics'
// The duration wording.
import { formatDuration } from '@/lib/analytics'
// Shapes.
import type { AnalyticsPeriod, AnalyticsReport } from '@/types/analytics'

import { Figure } from './Figure'

/** The grid of figures: two on phones, four on wide screens. */
const GRID = 'grid grid-cols-2 gap-4 lg:grid-cols-4'

/** A titled group of figures. */
function Group({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section aria-label={title} className="space-y-3">
      {/* The group's heading. */}
      <h2 className="text-lg font-semibold">{title}</h2>
      {/* Its figures. */}
      <div className={GRID}>{children}</div>
    </section>
  )
}

/** The four groups for a loaded report. */
function Groups({ report }: Readonly<{ report: AnalyticsReport }>) {
  const { users, academic, ai } = report
  return (
    <div className="space-y-8">
      <Group title="Users">
        <Figure label="Students" value={users.students} />
        <Figure label="Teachers" value={users.teachers} />
        <Figure label="New accounts" value={users.newUsers} note="Created in this period" />
        <Figure label="Inactive accounts" value={users.inactive} note="No sign-in for 30 days" />
        <Figure label="Active in the last 7 days" value={users.active7} />
        <Figure label="Active in the last 30 days" value={users.active30} />
      </Group>
      <Group title="Academic activity">
        <Figure label="Courses in use" value={academic.courses} />
        <Figure label="Classes" value={academic.classes} note="Held in this period" />
        <Figure label="Notes written" value={academic.notesCreated} />
        <Figure
          label="Drafts waiting for a teacher"
          value={academic.draftsWaiting}
          note="Right now"
        />
        <Figure label="Summaries generated" value={academic.summariesGenerated} />
        <Figure label="Summaries published" value={academic.summariesPublished} />
      </Group>
      <Group title="AI summaries">
        <Figure label="Jobs" value={ai.total} />
        <Figure label="Succeeded" value={ai.succeeded} />
        <Figure label="Failed" value={ai.failed} />
        <Figure label="Average time to a draft" value={formatDuration(ai.averageSeconds)} />
      </Group>
      <Group title="Not measured yet">
        <Figure label="Resources opened" value={null} />
        <Figure label="AI questions asked" value={null} />
      </Group>
    </div>
  )
}

/** The figures for `period`, with loading and error states. */
export function ReportSections({ period }: Readonly<{ period: AnalyticsPeriod }>) {
  // The report.
  const { data, isPending, isError, refetch } = useAnalyticsReport(period)

  // Failed: the message and a retry.
  if (isError) return <ErrorState thing="the analytics" onRetry={() => void refetch()} />

  // Loading: block-shaped placeholders, announced once.
  if (isPending) {
    return (
      <output aria-label="Loading the analytics" className="block space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </output>
    )
  }

  // Loaded.
  return <Groups report={data} />
}
