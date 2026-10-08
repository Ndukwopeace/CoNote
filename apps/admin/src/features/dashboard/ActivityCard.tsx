/**
 * The dashboard's one chart (admin REQUIREMENTS section 10): a range picker (7 / 30 / 90 days),
 * a series picker, and a table view of the same values.
 */

// The chosen range, series and view.
import { useState } from 'react'

// Buttons, loading blocks, and the class-name helper.
import { Button } from '@conote/ui/button'
import { Skeleton } from '@conote/ui/skeleton'
import { cn } from '@conote/ui/utils'

// Load-failure panel.
import { ErrorState } from '@/components/common/ErrorState'
// The series data.
import { useActivitySeries } from '@/hooks/useDashboard'
// Date labels for the table.
import { dayLabel } from '@/lib/chart'
// Range, series and point types.
import type { ActivityPoint, ActivityRange, ActivitySeriesKey } from '@/types/dashboard'

// The chart.
import { ActivityChart } from '@/components/dashboard/ActivityChart'

/** The ranges, in picker order. */
const RANGES: ActivityRange[] = [7, 30, 90]

/** The series and their labels, in picker order. */
const SERIES: Record<ActivitySeriesKey, string> = {
  notes_created: 'Notes created',
  summaries_generated: 'Summaries generated',
  summaries_published: 'Summaries published',
  resources_opened: 'Resources opened',
  ai_questions: 'AI questions',
}

/** Is `value` one of the series keys? Narrows the select's string without a cast. */
function isSeriesKey(value: string): value is ActivitySeriesKey {
  return Object.hasOwn(SERIES, value)
}

/** The same values as the chart, as a table. */
function ActivityTable({
  points,
  label,
  range,
}: Readonly<{ points: ActivityPoint[]; label: string; range: ActivityRange }>) {
  return (
    // The card grows with the table rather than nesting a scroll box inside it.
    <div className="rounded-md border">
      <table className="w-full text-sm">
        {/* Names the table for screen readers. */}
        <caption className="sr-only">
          {label} per day, last {range} days
        </caption>
        <thead className="sticky top-0 bg-card text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Day
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {label}
            </th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date} className="border-t">
              <td className="px-3 py-1.5">{dayLabel(point.date)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{point.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The card: heading, pickers, then the chart or table. */
export function ActivityCard() {
  // The chosen range, series, and whether the table is showing.
  const [range, setRange] = useState<ActivityRange>(7)
  const [series, setSeries] = useState<ActivitySeriesKey>('notes_created')
  const [showTable, setShowTable] = useState(false)
  // The data; the previous chart stays while a new choice loads.
  const { data, isPending, isError, isPlaceholderData, refetch } = useActivitySeries(range, series)
  // The series' label.
  const label = SERIES[series]

  /** The chart, the table, or a loading, empty or error state. */
  function body() {
    // Failed: the message and a retry.
    if (isError) return <ErrorState thing="activity" onRetry={() => void refetch()} />
    // First load: a chart-sized block.
    if (isPending) {
      return (
        <div role="status" aria-label="Loading activity">
          <Skeleton className="h-56" />
        </div>
      )
    }
    // Nothing happened in the period: say so rather than draw a flat line.
    if (data.every((point) => point.count === 0)) {
      return (
        <p className="flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Nothing was recorded in this period.
        </p>
      )
    }
    // The table view.
    if (showTable) return <ActivityTable points={data} label={label} range={range} />
    // The chart, dimmed while a new choice loads.
    return <ActivityChart points={data} label={label} refreshing={isPlaceholderData} />
  }

  return (
    <section aria-labelledby="activity-heading" className="rounded-xl border bg-card p-5">
      {/* Heading, then the pickers in one row (wrapping on phones). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="activity-heading" className="font-semibold">
          Activity
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* Range: one pressed button at a time. */}
          <div role="group" aria-label="Date range" className="flex rounded-md border p-0.5">
            {RANGES.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={range === days}
                aria-label={`Last ${days} days`}
                onClick={() => {
                  setRange(days)
                }}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  range === days
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {days} days
              </button>
            ))}
          </div>
          {/* Series: a native select, which works the same everywhere. */}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Show</span>
            <select
              value={series}
              onChange={(event) => {
                if (isSeriesKey(event.target.value)) setSeries(event.target.value)
              }}
              className="h-8 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {Object.entries(SERIES).map(([key, text]) => (
                <option key={key} value={key}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {/* The chart or table. */}
      <div className="mt-5">{body()}</div>
      {/* Switch between the chart and the table of the same values. */}
      {!isPending && !isError && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-2 px-0"
          onClick={() => {
            setShowTable((current) => !current)
          }}
        >
          {showTable ? 'Show as chart' : 'Show as table'}
        </Button>
      )}
    </section>
  )
}
