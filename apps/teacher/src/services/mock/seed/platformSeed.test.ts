/**
 * Tests for the teacher demo's platform records.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The demo sign-in accounts.
import { DEMO_ACCOUNTS } from '../mockAuthService'
// The service that reads the seed.
import { createMockTeachingService } from '../mockTeachingService'

// The unit under test.
import { createPlatformSeed } from './platformSeed'

/** A fixed clock, so the seed is the same on every run. */
const NOW = new Date('2026-10-12T10:00:00.000Z')

describe('createPlatformSeed', () => {
  // Proves every demo sign-in account is a user of the platform, so the sign-in check finds it.
  it('has a user for each demo account', () => {
    const emails = createPlatformSeed(NOW).users.map((user) => user.email)
    for (const account of DEMO_ACCOUNTS) expect(emails).toContain(account.email)
  })

  // Proves the demo teacher's list: her live courses, ongoing first, and nobody else's.
  it('gives the demo teacher two live courses, ongoing first', async () => {
    const service = createMockTeachingService({
      data: createPlatformSeed(NOW),
      actorId: () => 'teacher-1',
      latencyMs: 0,
    })
    const courses = await service.listMyCourses()
    expect(courses.map((course) => course.code)).toEqual(['MTH 202', 'MTH 301'])
  })

  // Proves the demo shows two summaries waiting on MTH 202, as the spec's acceptance scenario says.
  it('leaves two MTH 202 summaries waiting for review', async () => {
    const service = createMockTeachingService({
      data: createPlatformSeed(NOW),
      actorId: () => 'teacher-1',
      latencyMs: 0,
    })
    const [mth202] = await service.listMyCourses()
    expect(mth202).toMatchObject({ code: 'MTH 202', classCount: 7, waitingForReviewCount: 2 })
  })

  // Proves the seed covers every summary stage, so each one can be seen in the demo.
  it('covers every summary stage', () => {
    const stages = new Set(createPlatformSeed(NOW).summaries.map((summary) => summary.status))
    expect([...stages].sort()).toEqual(['collecting', 'in_review', 'processing', 'published'])
  })

  // Proves the archived course is archived, with its classes, and so never listed.
  it('archives the old course with its classes', () => {
    const data = createPlatformSeed(NOW)
    expect(data.courses.find((course) => course.id === 'mth-101')?.archivedAt).not.toBeNull()
    expect(
      data.classes.filter((cls) => cls.courseId === 'mth-101').every((cls) => cls.archivedAt),
    ).toBe(true)
  })
})
