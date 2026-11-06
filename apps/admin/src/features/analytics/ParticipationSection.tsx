/**
 * Who wrote notes, class by class (D124): the headline for the period, then a table with the
 * quietest classes first. Counts only; each row links to the Notes search, where names show and
 * every use is recorded.
 */

// Empty-state icon.
import { NotebookPen } from 'lucide-react'
// Client-side link.
import { Link } from 'react-router'

// Shared building blocks.
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel.
import { ErrorState } from '@conote/portal'
// The data.
import { useAnalyticsReport, useParticipation } from '@/hooks/useAnalytics'
// The rules.
import { quietestFirst, sharePercent } from '@/lib/analytics'
// Route constants and the query helper.
import { ADMIN_ROUTES, withQuery } from '@/lib/routes'
// The period shape.
import type { AnalyticsPeriod } from '@/types/analytics'

import { Figure } from './Figure'

/** A date as a person reads it. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' })
}

/** "62%" or a dash when there is no share to show. */
function formatShare(part: number, whole: number): string {
  const share = sharePercent(part, whole)
  return share === null ? '–' : `${String(share)}%`
}

/** The headline: how many students wrote, and how many notes were written. */
function Headline({ period }: Readonly<{ period: AnalyticsPeriod }>) {
  // The same report the other sections read, so this costs no second request.
  const { data } = useAnalyticsReport(period)
  // Nothing to show until the report is in; its own section shows the loading and error states.
  if (!data) return null
  const { studentsWhoWrote, studentsExpected } = data.participation
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Figure
        label="Students who sent notes"
        value={studentsWhoWrote}
        note={`of ${String(studentsExpected)} enrolled in a course with a class`}
      />
      <Figure
        label="Share of students who wrote"
        value={formatShare(studentsWhoWrote, studentsExpected)}
      />
      <Figure label="Notes written" value={data.academic.notesCreated} />
    </div>
  )
}

/** The class table, with loading, empty and error states. */
function ClassTable({ period }: Readonly<{ period: AnalyticsPeriod }>) {
  // The classes of the period.
  const { data, isPending, isError, refetch } = useParticipation(period)

  // Failed: the message and a retry.
  if (isError) return <ErrorState thing="the class table" onRetry={() => void refetch()} />

  // Loading.
  if (isPending) {
    return (
      <output aria-label="Loading the class table" className="block space-y-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </output>
    )
  }

  // No classes in the period.
  if (data.length === 0) {
    return (
      <EmptyState icon={NotebookPen} title="No classes in this period.">
        Choose a longer period to see more classes.
      </EmptyState>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Notes by class, quietest first</caption>
        <thead className="border-b text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Course
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Class
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Date
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Notes
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Students who wrote
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Share
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              <span className="sr-only">Notes</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {quietestFirst(data).map((row) => (
            <tr key={row.classId}>
              <td className="px-4 py-2">{row.courseCode}</td>
              <td className="px-4 py-2">{`Class ${String(row.classNumber)}: ${row.classTitle}`}</td>
              <td className="px-4 py-2">{formatDay(row.startsAt)}</td>
              <td className="px-4 py-2 text-right">{row.notes}</td>
              <td className="px-4 py-2 text-right">{`${String(row.writers)} of ${String(row.enrolled)}`}</td>
              <td className="px-4 py-2 text-right">{formatShare(row.writers, row.enrolled)}</td>
              <td className="px-4 py-2">
                <Link
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  to={withQuery(ADMIN_ROUTES.notes, {
                    courseId: row.courseId,
                    classId: row.classId,
                  })}
                  aria-label={`Read the notes of ${row.courseCode} class ${String(row.classNumber)}`}
                >
                  Read notes
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The participation part of the page. */
export function ParticipationSection({ period }: Readonly<{ period: AnalyticsPeriod }>) {
  return (
    <section aria-label="Who wrote notes" className="space-y-3">
      {/* The heading and what the numbers mean. */}
      <div>
        <h2 className="text-lg font-semibold">Who wrote notes</h2>
        <p className="text-sm text-muted-foreground">
          Counts only. Open a class to see which students wrote; each time you do is recorded in the
          audit log.
        </p>
      </div>
      {/* The headline. */}
      <Headline period={period} />
      {/* The classes, quietest first. */}
      <ClassTable period={period} />
    </section>
  )
}
