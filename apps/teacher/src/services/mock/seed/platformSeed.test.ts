/**
 * Tests for the teacher demo's platform records.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The demo sign-in accounts.
import { DEMO_ACCOUNTS } from '../mockAuthService'
// The draft's rules.
import { draftSchema } from '@/lib/draftSchema'
// The services that read the seed.
import { createMockReviewService } from '../mockReviewService'
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

  // Proves every drafted summary (in review or published) holds a draft that passes the rules, so
  // the demo can be saved and published without first fixing it.
  it('gives every drafted summary a valid draft', () => {
    const drafted = createPlatformSeed(NOW).summaries.filter(
      (summary) => summary.status === 'in_review' || summary.status === 'published',
    )
    expect(drafted.length).toBeGreaterThan(0)
    for (const summary of drafted) {
      expect(draftSchema.safeParse(summary.draft).success).toBe(true)
      expect(summary.notesAnalyzedCount).toBeGreaterThan(0)
    }
  })

  // Proves summaries not yet drafted have no text, and published ones say who published them.
  it('leaves undrafted summaries empty and credits published ones', () => {
    for (const summary of createPlatformSeed(NOW).summaries) {
      if (summary.status === 'collecting' || summary.status === 'processing') {
        expect(summary.draft.overview).toBe('')
      }
      if (summary.status === 'published') {
        expect(summary.publishedAt).not.toBeNull()
        expect(summary.reviewedBy).not.toBeNull()
      }
    }
  })

  // Proves the demo teacher's queue holds her two MTH 202 summaries, the older wait first, and
  // none of the other teacher's.
  it('queues the two MTH 202 summaries, oldest first', async () => {
    const service = createMockReviewService({
      data: createPlatformSeed(NOW),
      actorId: () => 'teacher-1',
      now: () => NOW,
      latencyMs: 0,
    })
    const queue = await service.listReviewQueue()
    expect(queue.map((item) => [item.courseCode, item.classNumber])).toEqual([
      ['MTH 202', 4],
      ['MTH 202', 5],
    ])
  })
})
