/**
 * What the dashboard shows (admin REQUIREMENTS section 10): the platform counts, the activity
 * series, system health and alerts. Services return these shapes; pages only display them.
 */

/** The six counts on the stat cards. */
export interface PlatformOverview {
  // Accounts with the student role, whatever their status.
  students: number
  // Accounts with the teacher role, whatever their status.
  teachers: number
  // Courses that are not archived.
  activeCourses: number
  // Classes that are not archived and start inside the current term.
  classesThisTerm: number
  // Summaries a teacher has published.
  publishedSummaries: number
  // AI jobs queued or running right now.
  activeAiJobs: number
}

/** How many days the activity chart covers. */
export type ActivityRange = 7 | 30 | 90

/** What the activity chart can count. */
export type ActivitySeriesKey =
  | 'notes_created'
  | 'summaries_generated'
  | 'summaries_published'
  | 'resources_opened'
  | 'ai_questions'

/** One day's count. */
export interface ActivityPoint {
  // The local calendar day, as YYYY-MM-DD.
  date: string
  // How many happened that day.
  count: number
}

/** The parts of the platform the health card lists, in display order. */
export const HEALTH_COMPONENTS = [
  'database',
  'authentication',
  'ai_service',
  'storage',
  'notifications',
] as const

/** One part of the platform. */
export type HealthComponent = (typeof HEALTH_COMPONENTS)[number]

/** How one part is doing. "unknown" means the health check didn't report it. */
export type HealthState = 'operational' | 'degraded' | 'unavailable' | 'unknown'

/** The health check's answer. */
export interface HealthReport {
  // When the check ran, as ISO text.
  checkedAt: string
  // The state of each part it could check. A part left out counts as "unknown".
  components: Partial<Record<HealthComponent, HealthState>>
}

/** The problems an alert can report, in display order (most urgent first). */
export const ALERT_KINDS = [
  'security_events',
  'ai_jobs_failed',
  'notifications_failed',
  'storage_errors',
  'courses_without_teacher',
  'classes_in_archived_courses',
  'summaries_waiting_review',
] as const

/** One kind of problem. */
export type AlertKind = (typeof ALERT_KINDS)[number]

/** One alert: a kind of problem and how many records have it. Only non-zero counts are sent. */
export interface PlatformAlert {
  kind: AlertKind
  count: number
  // For summaries_waiting_review only: the day limit from Settings that they passed.
  days?: number
}
