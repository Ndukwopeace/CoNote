/**
 * Every TanStack Query key in the console (ENGINEERING_STANDARDS.md 3.2). Reads and later cache
 * updates use these builders, so the two can't drift apart.
 */

// Types used in keys.
import type { ActivityRange, ActivitySeriesKey } from '@/types/dashboard'

/** Query keys, grouped by area. Each group's `all` key clears the whole area at once. */
export const queryKeys = {
  dashboard: {
    // Every dashboard query.
    all: ['dashboard'] as const,
    // The stat card counts.
    overview: () => [...queryKeys.dashboard.all, 'overview'] as const,
    // One series over one range; each combination caches apart.
    activity: (range: ActivityRange, series: ActivitySeriesKey) =>
      [...queryKeys.dashboard.all, 'activity', range, series] as const,
    // The alert list.
    alerts: () => [...queryKeys.dashboard.all, 'alerts'] as const,
    // The health report.
    health: () => [...queryKeys.dashboard.all, 'health'] as const,
  },
}
