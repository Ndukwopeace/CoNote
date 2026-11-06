/**
 * Analytics (admin REQUIREMENTS section 16, D124): measured activity across users, courses, notes,
 * summaries and AI for a chosen period, and which students wrote notes in which classes. Every
 * figure is a count; names appear only in the Notes search, which is audited.
 */

// The chosen period lives in the address.
import { useSearchParams } from 'react-router'

// The tab title, and the drop-down.
import { PageTitle } from '@conote/ui/common/PageTitle'
import { NativeSelect } from '@conote/ui/native-select'

// The page's parts.
import { ParticipationSection } from '@/features/analytics/ParticipationSection'
import { ReportSections } from '@/features/analytics/ReportSections'
// The period rule.
import { periodOf } from '@/lib/analytics'
// The period choices.
import type { AnalyticsDays } from '@/types/analytics'

/** The periods on offer, with how they read. */
const CHOICES: readonly { days: AnalyticsDays; label: string }[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
]

/** Reads `days` from the address; anything else means 30. */
function daysFrom(value: string | null): AnalyticsDays {
  // Only the offered choices count, so a crafted address cannot ask for another period.
  return CHOICES.find((choice) => String(choice.days) === value)?.days ?? 30
}

/** Analytics. */
export function AnalyticsPage() {
  // The address's query holds the period.
  const [params, setParams] = useSearchParams()
  const days = daysFrom(params.get('days'))
  // The period: whole days up to the end of today, so it only changes at midnight.
  const period = periodOf(days, new Date())

  return (
    <div className="space-y-8">
      {/* Tab title. */}
      <PageTitle title="Analytics" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Measured activity across users, courses, notes, summaries and AI. No names and no note
            text.
          </p>
        </div>
        {/* The period. */}
        <div className="grid gap-1 text-sm">
          <label htmlFor="analytics-period" className="font-medium">
            Period
          </label>
          <NativeSelect
            id="analytics-period"
            value={String(days)}
            onChange={(event) => {
              setParams({ days: event.target.value })
            }}
            className="sm:w-48"
          >
            {CHOICES.map((choice) => (
              <option key={choice.days} value={choice.days}>
                {choice.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </header>
      {/* Who wrote notes comes first: it is what instructors ask about. */}
      <ParticipationSection period={period} />
      {/* The rest of the platform's figures. */}
      <ReportSections period={period} />
    </div>
  )
}
