/**
 * Every TanStack Query key in the console (ENGINEERING_STANDARDS.md 3.2). Reads and later cache
 * updates use these builders, so the two can't drift apart.
 */

// Types used in keys.
import type { CourseFilter } from '@/types/courses'
import type { ActivityRange, ActivitySeriesKey } from '@/types/dashboard'
import type { UserFilter } from '@/types/users'

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
  courses: {
    // Every course query; cleared after any change to a course or its students.
    all: ['courses'] as const,
    // One filtered page; the filter object is part of the key, so each view caches apart.
    list: (filter: CourseFilter) => [...queryKeys.courses.all, 'list', filter] as const,
    // One course.
    detail: (courseId: string) => [...queryKeys.courses.all, 'detail', courseId] as const,
    // The filter and form choices.
    filterOptions: () => [...queryKeys.courses.all, 'filter-options'] as const,
    // A course's students, narrowed by a search.
    students: (courseId: string, q: string) =>
      [...queryKeys.courses.all, 'students', courseId, q] as const,
  },
  users: {
    // Every user query; cleared after any change to an account.
    all: ['users'] as const,
    // One filtered page; the filter object is part of the key, so each view caches apart.
    list: (filter: UserFilter) => [...queryKeys.users.all, 'list', filter] as const,
    // One account.
    detail: (userId: string) => [...queryKeys.users.all, 'detail', userId] as const,
    // The filter choices.
    filterOptions: () => [...queryKeys.users.all, 'filter-options'] as const,
  },
}
