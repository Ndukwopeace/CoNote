/**
 * Tests for the demo platform data. It is built relative to "now", so these rules must hold
 * whenever the demo is opened.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The demo sign-in accounts, which must exist as users too.
import { DEMO_ACCOUNTS } from '../mockAuthService'
// The services that read the seed.
import { createMockAlertService } from '../mockAlertService'
import { createMockAnalyticsService } from '../mockAnalyticsService'

// The builder under test.
import { createPlatformSeed } from './platformSeed'

// A morning, a late evening and just after midnight.
const nows = [new Date(2026, 9, 8, 9, 30), new Date(2026, 9, 8, 23, 50), new Date(2026, 9, 9, 0, 5)]

describe.each(nows)('createPlatformSeed at %s', (now) => {
  // The seed for this clock.
  const data = createPlatformSeed(now)

  // Proves the demo sign-in accounts are real users of the platform.
  it('includes the demo sign-in accounts', () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(data.users).toContainEqual(
        expect.objectContaining({ id: account.id, role: account.role }),
      )
    }
  })

  // Proves the student portal's four courses and teachers appear with the same IDs and names.
  it("shares the student portal's courses and teachers", () => {
    // Each shared course with its teacher's name.
    const taughtBy = (courseId: string) => {
      const teacherId = data.courses.find((course) => course.id === courseId)?.teacherId
      return data.users.find((user) => user.id === teacherId)?.fullName
    }
    expect(['swe-311', 'eng-201', 'cse-205', 'bus-207'].map(taughtBy)).toEqual([
      'Dr. Smith',
      'Mrs. Adeyemi',
      'Dr. Bello',
      'Mr. Okoro',
    ])
  })

  // Proves record IDs are unique, so later milestones can look them up.
  it('uses unique IDs', () => {
    for (const records of [data.users, data.courses, data.classes, data.summaries, data.aiJobs]) {
      const ids = records.map((record) => record.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  // Proves every class belongs to a seeded course.
  it('links every class to a course', () => {
    const courseIds = new Set(data.courses.map((course) => course.id))
    expect(data.classes.every((cls) => courseIds.has(cls.courseId))).toBe(true)
  })

  // Proves the term contains today, so "classes this term" is never zero.
  it('places today inside the term, with classes in it', async () => {
    // Act.
    const overview = await createMockAnalyticsService({
      data,
      now: () => now,
      latencyMs: 0,
    }).getOverview()

    // Assert: every card has something to show.
    expect(Object.values(overview).every((count) => count > 0)).toBe(true)
  })

  // Proves every chart series has activity in the last week.
  it('has activity in every series this week', async () => {
    // Arrange.
    const service = createMockAnalyticsService({ data, now: () => now, latencyMs: 0 })

    // Act and assert.
    for (const series of [
      'notes_created',
      'summaries_generated',
      'summaries_published',
      'resources_opened',
      'ai_questions',
    ] as const) {
      const points = await service.getActivitySeries(7, series)
      expect(points.some((point) => point.count > 0)).toBe(true)
    }
  })

  // Proves the demo shows a few alerts of different kinds, but not all of them.
  it('raises a few alerts', async () => {
    // Act.
    const alerts = await createMockAlertService({ data, now: () => now, latencyMs: 0 }).listAlerts()

    // Assert.
    expect(alerts.map((alert) => alert.kind)).toEqual([
      'security_events',
      'ai_jobs_failed',
      'notifications_failed',
      'courses_without_teacher',
      'classes_in_archived_courses',
      'summaries_waiting_review',
    ])
  })

  // Proves the seed is the same every time for the same clock, so demos are repeatable.
  it('is repeatable', () => {
    expect(createPlatformSeed(now)).toEqual(data)
  })
})
