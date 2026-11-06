/**
 * The Analytics page's data (D124). The figures and the class table load on their own, so one slow
 * or failed part never blanks the other.
 */

// Server state, and keeping the old figures while another period loads.
import { keepPreviousData, useQuery } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The services.
import { useServices } from '@/services/useServices'
// The period shape.
import type { AnalyticsPeriod } from '@/types/analytics'

// Query keys.
import { queryKeys } from './queryKeys'

/** The figures for a period. The previous period's stay on screen while the next one loads. */
export function useAnalyticsReport(period: AnalyticsPeriod) {
  // The analytics service.
  const { analytics } = useServices()
  return useQuery({
    queryKey: queryKeys.analytics.report(period),
    queryFn: () => appQuery(() => analytics.getReport(period)),
    placeholderData: keepPreviousData,
  })
}

/** The classes of a period with their note counts. */
export function useParticipation(period: AnalyticsPeriod) {
  // The analytics service.
  const { analytics } = useServices()
  return useQuery({
    queryKey: queryKeys.analytics.participation(period),
    queryFn: () => appQuery(() => analytics.getParticipation(period)),
    placeholderData: keepPreviousData,
  })
}
