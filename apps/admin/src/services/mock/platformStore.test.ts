/**
 * Tests for saving the demo platform's changes, so invitations and status changes survive a
 * reload like server data would.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Record builders.
import { emptyPlatformData, userRecord } from '../platformData'

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
})
