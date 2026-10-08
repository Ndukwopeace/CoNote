/**
 * The system health card (admin REQUIREMENTS section 10): each part of the platform with its
 * state in words, from the health check. A part the check didn't report shows "Unknown".
 */

// Icons for each state.
import { CircleAlert, CircleCheck, CircleHelp, CircleX, type LucideIcon } from 'lucide-react'

// Status badge and loading blocks.
import { Badge } from '@conote/ui/badge'
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel.
import { ErrorState } from '@/components/common/ErrorState'
// The health report.
import { useHealth } from '@/hooks/useDashboard'
// The parts and states.
import { HEALTH_COMPONENTS, type HealthComponent, type HealthState } from '@/types/dashboard'

/** Each part's name. */
const NAMES: Record<HealthComponent, string> = {
  database: 'Database',
  authentication: 'Authentication',
  ai_service: 'AI service',
  storage: 'Storage',
  notifications: 'Notifications',
}

/** Each state's word, badge colour and icon. The word is always shown, so colour never stands alone. */
const STATES: Record<
  HealthState,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline'; icon: LucideIcon }
> = {
  operational: { label: 'Operational', variant: 'success', icon: CircleCheck },
  degraded: { label: 'Degraded', variant: 'warning', icon: CircleAlert },
  unavailable: { label: 'Unavailable', variant: 'destructive', icon: CircleX },
  unknown: { label: 'Unknown', variant: 'outline', icon: CircleHelp },
}

/** "12:04", for the time of the last check. */
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** The parts and their states, or a loading or error state. */
function HealthBody() {
  // The latest report, refreshed every minute.
  const { data, isPending, isError, refetch } = useHealth()

  // Failed: the message and a retry.
  if (isError) return <ErrorState thing="system health" onRetry={() => void refetch()} />

  // Loading: a block per part, announced once.
  if (isPending) {
    return (
      <div role="status" aria-label="Loading system health" className="space-y-3">
        {HEALTH_COMPONENTS.map((component) => (
          <Skeleton key={component} className="h-6" />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Every part, in a fixed order; a part left out of the report is "unknown". */}
      <ul aria-label="System health" className="space-y-3">
        {HEALTH_COMPONENTS.map((component) => {
          // This part's look.
          const state = STATES[data.components[component] ?? 'unknown']
          const Icon = state.icon
          return (
            <li key={component} className="flex items-center justify-between gap-3 text-sm">
              {/* The part. */}
              <span>{NAMES[component]}</span>
              {/* Its state: icon and word on a tint. */}
              <Badge variant={state.variant}>
                <Icon aria-hidden="true" />
                {state.label}
              </Badge>
            </li>
          )
        })}
      </ul>
      {/* When the check ran. */}
      <p className="mt-4 text-xs text-muted-foreground">
        Last checked at {timeLabel(data.checkedAt)}
      </p>
    </>
  )
}

/** The card: a heading, then the parts. */
export function SystemHealthCard() {
  return (
    <section aria-labelledby="health-heading" className="rounded-xl border bg-card p-5">
      {/* Heading. */}
      <h2 id="health-heading" className="mb-4 font-semibold">
        System health
      </h2>
      {/* The parts, or a loading or error state. */}
      <HealthBody />
    </section>
  )
}
