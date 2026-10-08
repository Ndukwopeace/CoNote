/**
 * The rules every AlertService must follow (ENGINEERING_STANDARDS.md 2.5), run against each
 * implementation. Each test seeds one kind of problem, then checks the alert it raises.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The data the services read, and an empty starting set.
import { emptyPlatformData, type PlatformData } from '../platformData'
// The interface under test.
import type { AlertService } from '../types'

/** Builds a service over `data`, with the clock at `now`. */
export type CreateAlertService = (data: PlatformData, now: Date) => AlertService

/** Noon on 8 October 2026, local time: the contract's "now". */
const NOW = new Date(2026, 9, 8, 12)

/** `hours` hours before NOW, as ISO text. */
function hoursAgo(hours: number) {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString()
}

/** A course with the given teacher and archive state. */
function course(id: string, teacherId: string | null, archivedAt: string | null = null) {
  return { id, code: id, title: id, teacherId, archivedAt }
}

/** Registers the AlertService contract suite under `name`. */
export function describeAlertServiceContract(name: string, create: CreateAlertService) {
  describe(`AlertService contract: ${name}`, () => {
    // Proves a healthy platform raises nothing.
    it('raises no alerts when nothing is wrong', async () => {
      await expect(create(emptyPlatformData(), NOW).listAlerts()).resolves.toEqual([])
    })

    // Proves failures count only inside the last 24 hours.
    it('counts failures from the last 24 hours only', async () => {
      // Arrange: for each log, one entry 23 hours ago and one 25 hours ago.
      const data = emptyPlatformData({
        aiJobs: [
          { id: 'j1', classId: 'k1', status: 'failed', finishedAt: hoursAgo(23) },
          { id: 'j2', classId: 'k2', status: 'failed', finishedAt: hoursAgo(25) },
          { id: 'j3', classId: 'k3', status: 'succeeded', finishedAt: hoursAgo(1) },
        ],
        deliveryFailures: [
          { id: 'd1', at: hoursAgo(23) },
          { id: 'd2', at: hoursAgo(25) },
        ],
        storageErrors: [
          { id: 'e1', at: hoursAgo(23) },
          { id: 'e2', at: hoursAgo(25) },
        ],
        securityEvents: [
          { id: 'v1', action: 'auth.repeated_failed_sign_in', at: hoursAgo(23) },
          { id: 'v2', action: 'auth.repeated_failed_sign_in', at: hoursAgo(25) },
        ],
      })

      // Act.
      const alerts = await create(data, NOW).listAlerts()

      // Assert: one of each, most urgent first.
      expect(alerts).toEqual([
        { kind: 'security_events', count: 1 },
        { kind: 'ai_jobs_failed', count: 1 },
        { kind: 'notifications_failed', count: 1 },
        { kind: 'storage_errors', count: 1 },
      ])
    })

    // Proves only active courses without a teacher are reported.
    it('reports active courses without a teacher', async () => {
      // Arrange: one taught, one untaught, one untaught but archived.
      const data = emptyPlatformData({
        courses: [course('c1', 't1'), course('c2', null), course('c3', null, hoursAgo(48))],
      })

      // Act and assert.
      await expect(create(data, NOW).listAlerts()).resolves.toEqual([
        { kind: 'courses_without_teacher', count: 1 },
      ])
    })

    // Proves active classes under an archived course are reported, and archived ones aren't.
    it('reports active classes in archived courses', async () => {
      // Arrange.
      const data = emptyPlatformData({
        courses: [course('c1', 't1'), course('c2', 't1', hoursAgo(48))],
        classes: [
          { id: 'k1', courseId: 'c1', title: '1', startsAt: hoursAgo(5), archivedAt: null },
          { id: 'k2', courseId: 'c2', title: '2', startsAt: hoursAgo(5), archivedAt: null },
          { id: 'k3', courseId: 'c2', title: '3', startsAt: hoursAgo(5), archivedAt: hoursAgo(1) },
        ],
      })

      // Act and assert.
      await expect(create(data, NOW).listAlerts()).resolves.toEqual([
        { kind: 'classes_in_archived_courses', count: 1 },
      ])
    })

    // Proves the review limit comes from the settings, and the alert carries it.
    it('reports summaries waiting in review past the limit in Settings', async () => {
      // Arrange: a 2-day limit; one summary waiting 3 days, one waiting 1 day, one published.
      const data = emptyPlatformData({
        settings: { termStartsOn: '2026-09-01', termEndsOn: '2026-12-18', reviewAlertDays: 2 },
        summaries: [
          {
            id: 'x1',
            classId: 'k1',
            status: 'in_review',
            inReviewSince: hoursAgo(72),
            publishedAt: null,
          },
          {
            id: 'x2',
            classId: 'k2',
            status: 'in_review',
            inReviewSince: hoursAgo(24),
            publishedAt: null,
          },
          {
            id: 'x3',
            classId: 'k3',
            status: 'published',
            inReviewSince: null,
            publishedAt: hoursAgo(1),
          },
        ],
      })

      // Act and assert.
      await expect(create(data, NOW).listAlerts()).resolves.toEqual([
        { kind: 'summaries_waiting_review', count: 1, days: 2 },
      ])
    })
  })
}
