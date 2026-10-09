/**
 * Tests for saving the demo platform's changes, so invitations and status changes survive a
 * reload like server data would.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Record builders.
import {
  aiJobRecord,
  classRecord,
  courseRecord,
  emptyPlatformData,
  enrollmentRequestRecord,
  userRecord,
} from '../platformData'

// The units under test.
import { loadPlatform, PLATFORM_KEY, savePlatform } from './platformStore'

/** A small seed. */
function seed() {
  return emptyPlatformData({ users: [userRecord({ id: 's1', role: 'student' })] })
}

describe('platformStore', () => {
  // Proves nothing saved means the seed as it is.
  it('uses the seed when nothing is saved', () => {
    expect(loadPlatform(window.localStorage, seed())).toEqual(seed())
  })

  // Proves saved users, enrolments and audit entries replace the seed's.
  it('restores saved changes over the seed', () => {
    // Arrange: a change, saved.
    const changed = seed()
    changed.users.push(userRecord({ id: 's2', role: 'student', status: 'pending' }))
    changed.enrollments.push({ courseId: 'c1', studentId: 's1' })
    changed.auditLog.push({
      id: 'e1',
      at: '2026-10-08T12:00:00.000Z',
      actorId: 'a1',
      action: 'user.invited',
      entityType: 'user',
      entityId: 's2',
      metadata: { role: 'student', status: 'pending' },
    })
    savePlatform(window.localStorage, changed)

    // Act.
    const loaded = loadPlatform(window.localStorage, seed())

    // Assert.
    expect(loaded.users.map((user) => user.id)).toEqual(['s1', 's2'])
    expect(loaded.enrollments).toHaveLength(1)
    expect(loaded.auditLog).toHaveLength(1)
  })

  // Proves saved courses and resources come back, and a store saved before courses existed
  // still loads, keeping the seed's courses.
  it('restores saved courses and resources, and tolerates older saves', () => {
    // Arrange: a changed course and a resource, saved.
    const changed = emptyPlatformData({ courses: [courseRecord({ id: 'c1', title: 'Renamed' })] })
    changed.resources.push({
      id: 'r1',
      title: 'Outline',
      type: 'pdf',
      courseId: 'c1',
      classId: null,
      status: 'published',
      createdAt: '2026-09-01T09:00:00.000Z',
    })
    savePlatform(window.localStorage, changed)
    const withCourse = emptyPlatformData({ courses: [courseRecord({ id: 'c1', title: 'Seed' })] })

    // Act and assert: the saved course wins over the seed's.
    const loaded = loadPlatform(window.localStorage, withCourse)
    expect(loaded.courses.map((course) => course.title)).toEqual(['Renamed'])
    expect(loaded.resources).toHaveLength(1)

    // An older save has no courses: the seed's stay.
    window.localStorage.setItem(
      PLATFORM_KEY,
      JSON.stringify({ users: [], enrollments: [], auditLog: [] }),
    )
    expect(loadPlatform(window.localStorage, withCourse).courses).toHaveLength(1)
  })

  // Proves classes are saved with their summaries and AI jobs, so a restored class never
  // disagrees with the records that describe its summary.
  it('restores saved classes with their summaries and jobs', () => {
    // Arrange: a new class and its records, saved.
    const changed = emptyPlatformData({
      classes: [classRecord({ id: 'k1', courseId: 'c1', title: 'Renamed' })],
      summaries: [
        {
          id: 'sm1',
          classId: 'k1',
          status: 'in_review',
          inReviewSince: '2026-09-10T12:00:00.000Z',
          publishedAt: null,
        },
      ],
      aiJobs: [aiJobRecord({ id: 'j1', classId: 'k1', attempt: 2 })],
    })
    savePlatform(window.localStorage, changed)
    const seeded = emptyPlatformData({
      classes: [classRecord({ id: 'k1', courseId: 'c1', title: 'Seed' })],
    })

    // Act.
    const loaded = loadPlatform(window.localStorage, seeded)

    // Assert.
    expect(loaded.classes.map((item) => item.title)).toEqual(['Renamed'])
    expect(loaded.summaries).toHaveLength(1)
    expect(loaded.aiJobs[0]?.attempt).toBe(2)

    // An older save has none of them: the seed's stay.
    window.localStorage.setItem(
      PLATFORM_KEY,
      JSON.stringify({ users: [], enrollments: [], auditLog: [] }),
    )
    expect(loadPlatform(window.localStorage, seeded).classes).toHaveLength(1)
  })

  // Proves anything malformed is ignored, so a hand-edited store can't break the console.
  it.each(['not json', JSON.stringify({ users: [{ id: 1 }] }), JSON.stringify([])])(
    'ignores a malformed store: %s',
    (stored) => {
      // Arrange.
      window.localStorage.setItem(PLATFORM_KEY, stored)

      // Act and assert.
      expect(loadPlatform(window.localStorage, seed())).toEqual(seed())
    },
  )

  // Proves requests to join and their decisions are saved, and a store saved before requests
  // existed keeps the seed's.
  it('restores saved requests to join, and tolerates older saves', () => {
    // Arrange: a decided request, saved.
    const changed = emptyPlatformData({
      enrollmentRequests: [
        enrollmentRequestRecord({
          id: 'q1',
          courseId: 'c1',
          studentId: 's1',
          status: 'approved',
          decidedAt: '2026-09-21T09:00:00.000Z',
          decidedBy: 'a1',
        }),
      ],
    })
    savePlatform(window.localStorage, changed)
    const seeded = emptyPlatformData({
      enrollmentRequests: [enrollmentRequestRecord({ id: 'q9', courseId: 'c1', studentId: 's2' })],
    })

    // Act and assert: the saved decision wins over the seed.
    expect(loadPlatform(window.localStorage, seeded).enrollmentRequests).toEqual(
      changed.enrollmentRequests,
    )

    // An older save has no requests: the seed's stay.
    window.localStorage.setItem(
      PLATFORM_KEY,
      JSON.stringify({ users: [], enrollments: [], auditLog: [] }),
    )
    expect(loadPlatform(window.localStorage, seeded).enrollmentRequests).toHaveLength(1)
  })
})
