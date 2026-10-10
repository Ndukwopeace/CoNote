/**
 * The demo AlertService (admin REQUIREMENTS section 10): each alert counted from the demo
 * platform records, the way the database will count them.
 */

// The alert kinds, in display order.
import { ALERT_KINDS, type AlertKind, type PlatformAlert } from '@/types/dashboard'

// The records it reads.
import type { PlatformData } from '../platformData'
// The interface implemented here.
import type { AlertService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'

/** What the demo service needs: the records, the clock, and how slow to pretend to be. */
interface MockAlertOptions {
  data: PlatformData
  now: () => Date
  latencyMs: number
}

/** How far back failures count: the last 24 hours. */
const RECENT_MS = 24 * 60 * 60 * 1000

/** Milliseconds in a day, for the review limit. */
const DAY_MS = 24 * 60 * 60 * 1000

/** Builds the demo AlertService over `data`. */
export function createMockAlertService({ data, now, latencyMs }: MockAlertOptions): AlertService {
  return {
    async listAlerts() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // The current time, read once so every count uses the same moment.
      const nowMs = now().getTime()
      // Was `at` within the last 24 hours?
      const recent = (at: string | null) => at !== null && nowMs - Date.parse(at) <= RECENT_MS
      // Archived course IDs, for the class check.
      const archivedCourses = new Set(
        data.courses.filter((course) => course.archivedAt !== null).map((course) => course.id),
      )
      // The review limit from Settings.
      const days = data.settings.reviewAlertDays

      // Every kind's count.
      const counts: Record<AlertKind, number> = {
        security_events: data.securityEvents.filter((event) => recent(event.at)).length,
        ai_jobs_failed: data.aiJobs.filter(
          (job) => job.status === 'failed' && recent(job.finishedAt),
        ).length,
        notifications_failed: data.deliveryFailures.filter((failure) => recent(failure.at)).length,
        storage_errors: data.storageErrors.filter((error) => recent(error.at)).length,
        courses_without_teacher: data.courses.filter(
          (course) => course.archivedAt === null && course.teacherId === null,
        ).length,
        classes_in_archived_courses: data.classes.filter(
          (cls) => cls.archivedAt === null && archivedCourses.has(cls.courseId),
        ).length,
        enrollment_requests_waiting: data.enrollmentRequests.filter(
          (request) => request.status === 'pending' && !archivedCourses.has(request.courseId),
        ).length,
        summaries_waiting_review: data.summaries.filter(
          (summary) =>
            summary.status === 'in_review' &&
            summary.inReviewSince !== null &&
            nowMs - Date.parse(summary.inReviewSince) > days * DAY_MS,
        ).length,
      }

      // Only the kinds with something to report, most urgent first.
      return ALERT_KINDS.filter((kind) => counts[kind] > 0).map((kind): PlatformAlert =>
        kind === 'summaries_waiting_review'
          ? { kind, count: counts[kind], days }
          : { kind, count: counts[kind] },
      )
    },
  }
}
