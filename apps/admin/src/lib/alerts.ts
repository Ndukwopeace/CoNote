/**
 * How each dashboard alert reads, how urgent it is, and which screen fixes it (admin REQUIREMENTS
 * section 10). The service sends only the kind and the count; the wording lives here.
 */

// Exhaustiveness helper.
import { assertNever } from '@conote/core/assertNever'

// Alert shape.
import type { PlatformAlert } from '@/types/dashboard'

// Route constants and the query helper.
import { ADMIN_ROUTES, withQuery } from './routes'

/** How urgent an alert is. Critical alerts are listed in red, warnings in amber. */
export type AlertSeverity = 'critical' | 'warning'

/** What the alert list shows for one alert. */
export interface AlertContent {
  message: string
  severity: AlertSeverity
  // The screen that fixes it, filtered to the problem.
  to: string
}

/** "1 course" or "4 courses". */
function counted(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

/** "has" or "have", to agree with `count`. */
function has(count: number) {
  return count === 1 ? 'has' : 'have'
}

/** The wording, severity and link for `alert`. */
export function alertContent({ kind, count, days }: PlatformAlert): AlertContent {
  switch (kind) {
    // Audit entries such as repeated failed sign-ins.
    case 'security_events':
      return {
        message: `${counted(count, 'security event', 'security events')} in the last 24 hours`,
        severity: 'critical',
        to: withQuery(ADMIN_ROUTES.auditLogs, { category: 'security' }),
      }
    // Summary jobs that failed.
    case 'ai_jobs_failed':
      return {
        message: `${counted(count, 'AI job', 'AI jobs')} failed in the last 24 hours`,
        severity: 'critical',
        to: withQuery(ADMIN_ROUTES.aiSummaries, { job: 'failed' }),
      }
    // Notifications that couldn't be delivered.
    case 'notifications_failed':
      return {
        message: `${counted(count, 'notification', 'notifications')} failed to send in the last 24 hours`,
        severity: 'critical',
        to: withQuery(ADMIN_ROUTES.settings, { tab: 'notifications' }),
      }
    // Uploads and other storage operations that failed.
    case 'storage_errors':
      return {
        message: `${counted(count, 'storage error', 'storage errors')} in the last 24 hours`,
        severity: 'critical',
        to: withQuery(ADMIN_ROUTES.resources, { status: 'error' }),
      }
    // Courses nobody teaches.
    case 'courses_without_teacher':
      return {
        message: `${counted(count, 'course', 'courses')} ${has(count)} no teacher`,
        severity: 'warning',
        to: withQuery(ADMIN_ROUTES.courses, { teacher: 'none' }),
      }
    // Classes left active under an archived course.
    case 'classes_in_archived_courses':
      return {
        message: `${counted(count, 'class belongs', 'classes belong')} to an archived course`,
        severity: 'warning',
        to: withQuery(ADMIN_ROUTES.classes, { course: 'archived' }),
      }
    // Summaries no teacher has acted on in time.
    case 'summaries_waiting_review':
      return {
        message: `${counted(count, 'summary', 'summaries')} ${has(count)} waited in review for more than ${counted(days ?? 0, 'day', 'days')}`,
        severity: 'warning',
        to: withQuery(ADMIN_ROUTES.aiSummaries, { status: 'in_review' }),
      }
    // Students' requests to join courses, waiting for an administrator (D76).
    case 'enrollment_requests_waiting':
      return {
        message: `${counted(count, 'student', 'students')} waiting to join a course`,
        severity: 'warning',
        to: withQuery(ADMIN_ROUTES.courses, { requests: 'waiting' }),
      }
    // A new kind must be described here before the code compiles.
    default:
      return assertNever(kind)
  }
}
