/**
 * The dashboard's data (admin REQUIREMENTS section 10). Each part loads on its own, so one slow
 * or failed part never blanks the others.
 */

// Server state, and keeping the old chart while a new range loads.
import { keepPreviousData, useQuery } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The services.
import { useServices } from '@/services/useServices'
// Dashboard types.
import type { ActivityRange, ActivitySeriesKey } from '@/types/dashboard'

// Query keys.
import { queryKeys } from './queryKeys'

/** How often the health card checks again while the dashboard is open. */
const HEALTH_REFRESH_MS = 60_000

/** The stat card counts. */
export function useOverview() {
  // The analytics service.
  const { analytics } = useServices()
  return useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: () => appQuery(() => analytics.getOverview()),
  })
}

/** One series over one range, for the activity chart. */
export function useActivitySeries(range: ActivityRange, series: ActivitySeriesKey) {
  // The analytics service.
  const { analytics } = useServices()
  return useQuery({
    queryKey: queryKeys.dashboard.activity(range, series),
    queryFn: () => appQuery(() => analytics.getActivitySeries(range, series)),
    // Keep showing the previous chart while another range or series loads, so nothing jumps.
    placeholderData: keepPreviousData,
  })
}

/** The alert list. */
export function useAlerts() {
  // The alert service.
  const { alerts } = useServices()
  return useQuery({
    queryKey: queryKeys.dashboard.alerts(),
    queryFn: () => appQuery(() => alerts.listAlerts()),
  })
}

/** The health report, checked again every minute while the dashboard is open. */
export function useHealth() {
  // The health service.
  const { health } = useServices()
  return useQuery({
    queryKey: queryKeys.dashboard.health(),
    queryFn: () => appQuery(() => health.getHealth()),
    refetchInterval: HEALTH_REFRESH_MS,
  })
}
