/**
 * The rules every AnalyticsService must follow (ENGINEERING_STANDARDS.md 2.5), run against each
 * implementation. Each test seeds only the records it needs, then checks the figures.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared vocabulary.
import type { AccountStatus, Role } from '@conote/domain'

// The data the services read, and an empty starting set.
import { courseRecord, emptyPlatformData, userRecord, type PlatformData } from '../platformData'
// The interface under test.
import type { AnalyticsService } from '../types'

/** Builds a service over `data`, with the clock at `now`. */
export type CreateAnalyticsService = (data: PlatformData, now: Date) => AnalyticsService

/** Noon on 8 October 2026, local time: the contract's "now". */
const NOW = new Date(2026, 9, 8, 12)

/** `days` days before NOW, at the given local hour, as ISO text. */
function daysAgo(days: number, hour = 10) {
  return new Date(2026, 9, 8 - days, hour).toISOString()
}

/** Registers the AnalyticsService contract suite under `name`. */
export function describeAnalyticsServiceContract(name: string, create: CreateAnalyticsService) {
  describe(`AnalyticsService contract: ${name}`, () => {
    // Proves an empty platform reports zero everywhere.
    it('reports zeros for an empty platform', async () => {
      await expect(create(emptyPlatformData(), NOW).getOverview()).resolves.toEqual({
        students: 0,
        teachers: 0,
        activeCourses: 0,
        classesThisTerm: 0,
        publishedSummaries: 0,
        activeAiJobs: 0,
      })
    })

    // Proves students and teachers are counted by role, whatever their status, and admins aren't.
    it('counts students and teachers by role', async () => {
      // Arrange.
      const user = (id: string, role: Role, status: AccountStatus = 'active') =>
        userRecord({ id, role, status })
      const data = emptyPlatformData({
        users: [
          user('s1', 'student'),
          user('s2', 'student', 'pending'),
          user('s3', 'student', 'suspended'),
          user('t1', 'teacher'),
          user('a1', 'admin'),
        ],
      })

      // Act.
      const overview = await create(data, NOW).getOverview()

      // Assert.
      expect(overview).toMatchObject({ students: 3, teachers: 1 })
    })

    // Proves archived courses and classes, and classes outside the term, are left out.
    it('counts active courses and the classes of this term', async () => {
      // Arrange: a term from 1 September to 18 December 2026.
      const data = emptyPlatformData({
        courses: [
          courseRecord({ id: 'c1', code: 'A', title: 'A', teacherId: 't1', archivedAt: null }),
          courseRecord({
            id: 'c2',
            code: 'B',
            title: 'B',
            teacherId: null,
            archivedAt: daysAgo(10),
          }),
        ],
        classes: [
          // Inside the term, on its first and last days.
          {
            id: 'k1',
            courseId: 'c1',
            title: '1',
            startsAt: new Date(2026, 8, 1, 9).toISOString(),
            archivedAt: null,
          },
          {
            id: 'k2',
            courseId: 'c1',
            title: '2',
            startsAt: new Date(2026, 11, 18, 15).toISOString(),
            archivedAt: null,
          },
          // Before the term.
          {
            id: 'k3',
            courseId: 'c1',
            title: '3',
            startsAt: new Date(2026, 7, 31, 9).toISOString(),
            archivedAt: null,
          },
          // Inside the term but archived.
          { id: 'k4', courseId: 'c1', title: '4', startsAt: daysAgo(3), archivedAt: daysAgo(1) },
        ],
      })

      // Act.
      const overview = await create(data, NOW).getOverview()

      // Assert.
      expect(overview).toMatchObject({ activeCourses: 1, classesThisTerm: 2 })
    })

    // Proves only published summaries and only queued or running jobs are counted.
    it('counts published summaries and active AI jobs', async () => {
      // Arrange.
      const data = emptyPlatformData({
        summaries: [
          {
            id: 'x1',
            classId: 'k1',
            status: 'published',
            inReviewSince: null,
            publishedAt: daysAgo(1),
          },
          {
            id: 'x2',
            classId: 'k2',
            status: 'in_review',
            inReviewSince: daysAgo(1),
            publishedAt: null,
          },
        ],
        aiJobs: [
          { id: 'j1', classId: 'k1', status: 'queued', finishedAt: null },
          { id: 'j2', classId: 'k2', status: 'running', finishedAt: null },
          { id: 'j3', classId: 'k3', status: 'succeeded', finishedAt: daysAgo(1) },
          { id: 'j4', classId: 'k4', status: 'failed', finishedAt: daysAgo(1) },
        ],
      })

      // Act.
      const overview = await create(data, NOW).getOverview()

      // Assert.
      expect(overview).toMatchObject({ publishedSummaries: 1, activeAiJobs: 2 })
    })

    // Proves the series covers exactly the range, oldest first, ending today.
    it('returns one point per day of the range, ending today', async () => {
      // Act.
      const points = await create(emptyPlatformData(), NOW).getActivitySeries(7, 'notes_created')

      // Assert.
      expect(points).toHaveLength(7)
      expect(points[0]?.date).toBe('2026-10-02')
      expect(points.at(-1)?.date).toBe('2026-10-08')
    })

    // Proves each series counts its own events, and nothing older than the range.
    it('counts each series from its own records', async () => {
      // Arrange: one of each event today and yesterday, one note long ago, and a sign-in.
      const data = emptyPlatformData({
        activity: [
          { kind: 'note_created', at: daysAgo(0) },
          { kind: 'note_created', at: daysAgo(1) },
          { kind: 'note_created', at: daysAgo(40) },
          { kind: 'resource_opened', at: daysAgo(0) },
          { kind: 'ai_question', at: daysAgo(0) },
          { kind: 'sign_in', at: daysAgo(0) },
        ],
        aiJobs: [
          { id: 'j1', classId: 'k1', status: 'succeeded', finishedAt: daysAgo(0) },
          { id: 'j2', classId: 'k2', status: 'failed', finishedAt: daysAgo(0) },
        ],
        summaries: [
          {
            id: 'x1',
            classId: 'k1',
            status: 'published',
            inReviewSince: null,
            publishedAt: daysAgo(1),
          },
        ],
      })
      const service = create(data, NOW)
      // The total of a 30-day series.
      const total = async (series: Parameters<AnalyticsService['getActivitySeries']>[1]) =>
        (await service.getActivitySeries(30, series)).reduce((sum, point) => sum + point.count, 0)

      // Assert: the note from 40 days ago is outside a 30-day range.
      await expect(total('notes_created')).resolves.toBe(2)
      await expect(total('resources_opened')).resolves.toBe(1)
      await expect(total('ai_questions')).resolves.toBe(1)
      // Only the job that succeeded generated a summary.
      await expect(total('summaries_generated')).resolves.toBe(1)
      await expect(total('summaries_published')).resolves.toBe(1)
    })
  })
}
