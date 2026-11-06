/**
 * The rules every AnalyticsService must follow (ENGINEERING_STANDARDS.md 2.5), run against each
 * implementation. Each test seeds only the records it needs, then checks the figures.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared vocabulary.
import type { AccountStatus, Role } from '@conote/domain'

// The data the services read, and an empty starting set.
import {
  courseRecord,
  type NoteRecord,
  emptyPlatformData,
  userRecord,
  type PlatformData,
  classRecord,
  aiJobRecord,
} from '../platformData'
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
          classRecord({
            id: 'k1',
            courseId: 'c1',
            title: '1',
            startsAt: new Date(2026, 8, 1, 9).toISOString(),
            archivedAt: null,
          }),
          classRecord({
            id: 'k2',
            courseId: 'c1',
            title: '2',
            startsAt: new Date(2026, 11, 18, 15).toISOString(),
            archivedAt: null,
          }),
          // Before the term.
          classRecord({
            id: 'k3',
            courseId: 'c1',
            title: '3',
            startsAt: new Date(2026, 7, 31, 9).toISOString(),
            archivedAt: null,
          }),
          // Inside the term but archived.
          classRecord({
            id: 'k4',
            courseId: 'c1',
            title: '4',
            startsAt: daysAgo(3),
            archivedAt: daysAgo(1),
          }),
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
          aiJobRecord({ id: 'j1', classId: 'k1', status: 'queued', finishedAt: null }),
          aiJobRecord({ id: 'j2', classId: 'k2', status: 'running', finishedAt: null }),
          aiJobRecord({ id: 'j3', classId: 'k3', status: 'succeeded', finishedAt: daysAgo(1) }),
          aiJobRecord({ id: 'j4', classId: 'k4', status: 'failed', finishedAt: daysAgo(1) }),
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
          aiJobRecord({ id: 'j1', classId: 'k1', status: 'succeeded', finishedAt: daysAgo(0) }),
          aiJobRecord({ id: 'j2', classId: 'k2', status: 'failed', finishedAt: daysAgo(0) }),
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

    // The Analytics page (D124). Notes are not period-tested here: the real database stamps notes
    // with the real clock, so the demo's own tests and the SQL tests cover the note periods.
    describe('report', () => {
      /** The period "the last week, up to tomorrow" on the contract's clock. */
      const WEEK = { from: daysAgo(7), to: daysAgo(-1) }

      // Proves an empty platform reports zero everywhere, and no average.
      it('reports zeros and no average for an empty platform', async () => {
        const report = await create(emptyPlatformData(), NOW).getReport(WEEK)

        expect(report.users).toEqual({
          students: 0,
          teachers: 0,
          newUsers: 0,
          active7: 0,
          active30: 0,
          inactive: 0,
        })
        expect(report.academic).toMatchObject({ courses: 0, classes: 0, draftsWaiting: 0 })
        expect(report.ai).toEqual({ total: 0, succeeded: 0, failed: 0, averageSeconds: null })
        expect(report.participation).toEqual({ studentsWhoWrote: 0, studentsExpected: 0 })
      })

      // Proves new accounts, the two sign-in windows and the inactive count.
      it('counts new, active and inactive students and teachers', async () => {
        const person = (id: string, role: Role, createdDaysAgo: number, active: number | null) =>
          userRecord({
            id,
            role,
            createdAt: daysAgo(createdDaysAgo),
            lastActiveAt: active === null ? null : daysAgo(active),
          })
        const data = emptyPlatformData({
          users: [
            person('s1', 'student', 2, 1),
            person('s2', 'student', 60, 20),
            person('s3', 'student', 60, 45),
            person('s4', 'student', 60, null),
            person('t1', 'teacher', 3, 0),
          ],
        })

        const { users } = await create(data, NOW).getReport(WEEK)

        expect(users).toMatchObject({
          students: 4,
          teachers: 1,
          // s1 and t1 were created inside the week.
          newUsers: 2,
          // s1 and t1 signed in this week; s2 within the month.
          active7: 2,
          active30: 3,
          // s3 (45 days ago) and s4 (never) have not signed in for 30 days.
          inactive: 2,
        })
      })

      // Proves classes, courses, summaries and drafts are counted for the period.
      it('counts the period’s classes, drafts and published summaries', async () => {
        const data = emptyPlatformData({
          courses: [
            courseRecord({ id: 'c1' }),
            courseRecord({ id: 'c2', archivedAt: daysAgo(10) }),
          ],
          classes: [
            classRecord({ id: 'k1', courseId: 'c1', title: 'in', startsAt: daysAgo(2) }),
            classRecord({ id: 'k2', courseId: 'c1', title: 'old', startsAt: daysAgo(40) }),
            classRecord({
              id: 'k3',
              courseId: 'c1',
              title: 'archived',
              startsAt: daysAgo(3),
              archivedAt: daysAgo(1),
            }),
          ],
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
              status: 'published',
              inReviewSince: null,
              publishedAt: daysAgo(30),
            },
            {
              id: 'x3',
              classId: 'k3',
              status: 'in_review',
              inReviewSince: daysAgo(1),
              publishedAt: null,
            },
          ],
          aiJobs: [
            aiJobRecord({ id: 'j1', classId: 'k1', createdAt: daysAgo(2), finishedAt: daysAgo(2) }),
          ],
        })

        const { academic } = await create(data, NOW).getReport(WEEK)

        expect(academic).toMatchObject({
          courses: 1,
          classes: 1,
          summariesPublished: 1,
          draftsWaiting: 1,
          summariesGenerated: 1,
        })
      })

      // Proves the AI figures: jobs queued in the period, how they ended, and the average time.
      it('counts AI jobs of the period and averages the time of those that succeeded', async () => {
        const at = (daysBack: number, seconds: number) =>
          new Date(Date.parse(daysAgo(daysBack)) + seconds * 1000).toISOString()
        const data = emptyPlatformData({
          aiJobs: [
            aiJobRecord({ id: 'j1', classId: 'k1', createdAt: daysAgo(1), finishedAt: at(1, 60) }),
            aiJobRecord({ id: 'j2', classId: 'k2', createdAt: daysAgo(2), finishedAt: at(2, 120) }),
            aiJobRecord({
              id: 'j3',
              classId: 'k3',
              status: 'failed',
              createdAt: daysAgo(2),
              finishedAt: at(2, 5),
            }),
            aiJobRecord({
              id: 'j4',
              classId: 'k4',
              createdAt: daysAgo(30),
              finishedAt: at(30, 600),
            }),
          ],
        })

        const { ai } = await create(data, NOW).getReport(WEEK)

        expect(ai).toEqual({ total: 3, succeeded: 2, failed: 1, averageSeconds: 90 })
      })
    })

    describe('participation', () => {
      /** The period "the last week, up to tomorrow". */
      const WEEK = { from: daysAgo(7), to: daysAgo(-1) }

      /** Notes the way the real-database loader writes them: the students in turn. */
      function notesFor(
        classes: { id: string; noteCount: number }[],
        students: string[],
      ): NoteRecord[] {
        return classes.flatMap((cls) =>
          Array.from({ length: cls.noteCount }, (_unused, index) => ({
            id: `${cls.id}-n${String(index)}`,
            classId: cls.id,
            studentId: students[index % students.length] ?? '',
            title: null,
            contentHtml: '<p>x</p>',
            createdAt: daysAgo(1),
          })),
        )
      }

      // Proves each class of the period lists its notes, writers and enrolled students, newest
      // first, and leaves out classes outside the period and archived ones.
      it('lists the period’s classes with notes, writers and enrolled students', async () => {
        const students = ['s1', 's2', 's3']
        const classes = [
          classRecord({
            id: 'k1',
            courseId: 'c1',
            number: 1,
            title: 'First',
            startsAt: daysAgo(4),
            noteCount: 2,
          }),
          classRecord({
            id: 'k2',
            courseId: 'c1',
            number: 2,
            title: 'Second',
            startsAt: daysAgo(1),
            noteCount: 0,
          }),
          classRecord({
            id: 'k3',
            courseId: 'c1',
            number: 3,
            title: 'Old',
            startsAt: daysAgo(40),
            noteCount: 1,
          }),
          classRecord({
            id: 'k4',
            courseId: 'c1',
            number: 4,
            title: 'Gone',
            startsAt: daysAgo(2),
            archivedAt: daysAgo(1),
          }),
        ]
        const data = emptyPlatformData({
          users: students.map((id) => userRecord({ id, role: 'student' })),
          courses: [courseRecord({ id: 'c1', code: 'MTH 202' })],
          enrollments: students.map((studentId) => ({ courseId: 'c1', studentId })),
          classes,
          notes: notesFor(classes, students),
        })

        const rows = await create(data, NOW).getParticipation(WEEK)

        expect(rows.map((row) => row.classTitle)).toEqual(['Second', 'First'])
        expect(rows[1]).toMatchObject({
          courseCode: 'MTH 202',
          notes: 2,
          writers: 2,
          enrolled: 3,
        })
        expect(rows[0]).toMatchObject({ notes: 0, writers: 0, enrolled: 3 })
      })

      // SECURITY: proves a row holds counts and class names only, nothing that names a student.
      it('holds no student name or note text', async () => {
        const classes = [
          classRecord({
            id: 'k1',
            courseId: 'c1',
            title: 'First',
            startsAt: daysAgo(1),
            noteCount: 1,
          }),
        ]
        const data = emptyPlatformData({
          users: [userRecord({ id: 's1', role: 'student', fullName: 'Secret Name' })],
          courses: [courseRecord({ id: 'c1' })],
          enrollments: [{ courseId: 'c1', studentId: 's1' }],
          classes,
          notes: notesFor(classes, ['s1']),
        })

        const rows = await create(data, NOW).getParticipation(WEEK)

        expect(JSON.stringify(rows)).not.toContain('Secret Name')
      })
    })
  })
}
