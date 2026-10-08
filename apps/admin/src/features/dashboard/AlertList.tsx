/**
 * The dashboard's alerts (admin REQUIREMENTS section 10): each computed from the platform's
 * records, worded plainly, and linked to the screen that fixes it.
 */

// Icons for each severity, and the "go" chevron.
import { ChevronRight, OctagonAlert, TriangleAlert } from 'lucide-react'
// Client-side links.
import { Link } from 'react-router'

// Loading blocks.
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel.
import { ErrorState } from '@/components/common/ErrorState'
// The alerts.
import { useAlerts } from '@/hooks/useDashboard'
// Each alert's wording, severity and link.
import { alertContent } from '@/lib/alerts'

/** The alerts as links, or a loading, empty or error state. */
function AlertBody() {
  // The current alerts.
  const { data, isPending, isError, refetch } = useAlerts()

  // Failed: the message and a retry.
  if (isError) return <ErrorState thing="alerts" onRetry={() => void refetch()} />

  // Loading: a few rows, announced once.
  if (isPending) {
    return (
      <output aria-label="Loading alerts" className="block space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </output>
    )
  }

  // Nothing wrong: say so.
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No alerts. Everything is running normally.</p>
    )
  }

  return (
    <ul aria-label="Alerts" className="-mx-2 space-y-1 lg:columns-2 lg:gap-x-6">
      {data.map((alert) => {
        // The wording, severity and link.
        const { message, severity, to } = alertContent(alert)
        const critical = severity === 'critical'
        const Icon = critical ? OctagonAlert : TriangleAlert
        return (
          <li key={alert.kind} className="break-inside-avoid">
            {/* The whole row opens the screen that fixes it. */}
            <Link
              to={to}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {/* Severity: a different icon shape and colour, plus a word for screen readers. */}
              <Icon
                aria-hidden="true"
                className={`size-4 shrink-0 ${critical ? 'text-error-strong' : 'text-warning-strong'}`}
              />
              <span className="flex-1">
                <span className="sr-only">{critical ? 'Critical: ' : 'Warning: '}</span>
                {message}
              </span>
              {/* Decorative chevron. */}
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** The card: a heading, then the alerts. */
export function AlertList() {
  return (
    <section aria-labelledby="alerts-heading" className="rounded-xl border bg-card p-5">
      {/* Heading. */}
      <h2 id="alerts-heading" className="mb-3 font-semibold">
        Alerts
      </h2>
      {/* The alerts, or a loading, empty or error state. */}
      <AlertBody />
    </section>
  )
}
