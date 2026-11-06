/**
 * Tests for the admin demo's note reading service (D123): the shared contract, plus what is
 * specific to the demo: a signed-out visitor, and the demo's notes agreeing with its class counts.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared contract every implementation meets.
import { runNoteReadingContract } from '@conote/portal/testing'

import { createMockNoteReadingService } from './mockNoteReadingService'
import { createPlatformSeed } from './seed/platformSeed'

/** The demo platform, built once. */
const seed = createPlatformSeed(new Date())

/** The service as the demo administrator, or as nobody. */
function create(actor: string | null = 'admin-1') {
  return createMockNoteReadingService({ data: seed, actorId: () => actor, latencyMs: 0 })
}

/** A class with notes, and the numbers the contract needs about it. */
const withNotes = seed.classes.find((cls) => cls.noteCount > 2 && cls.archivedAt === null)
const noteHolders = seed.notes.filter((note) => note.classId === withNotes?.id)
const students = seed.enrollments.filter((item) => item.courseId === withNotes?.courseId)
const author = seed.users.find((user) => user.id === noteHolders[0]?.studentId)

runNoteReadingContract('admin demo', {
  create: () => create(),
  fixture: {
    classId: withNotes?.id ?? '',
    courseId: withNotes?.courseId ?? '',
    notes: noteHolders.length,
    writers: new Set(noteHolders.map((note) => note.studentId)).size,
    students: new Set([
      ...students.map((item) => item.studentId),
      ...noteHolders.map((n) => n.studentId),
    ]).size,
    studentId: author?.id ?? '',
    studentText: author?.fullName ?? '',
    unknownClassId: 'no-such-class',
  },
})

describe('admin demo note reading', () => {
  // SECURITY: proves nobody who is signed out can read a note or a roster.
  it('refuses a visitor who is not signed in', async () => {
    const visitor = create(null)

    await expect(visitor.searchNotes({})).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(visitor.getNoteRoster(withNotes?.id ?? '')).rejects.toMatchObject({
      kind: 'unauthorized',
    })
  })

  // Proves the demo's class counts and its notes tell one story, and that someone has not written.
  it('has as many notes as each class counts, with at least one silent student somewhere', async () => {
    const reader = create()
    for (const cls of seed.classes.filter((item) => item.noteCount > 0)) {
      const students = seed.enrollments.filter((item) => item.courseId === cls.courseId)
      // A class of a course nobody is in has no notes to count.
      if (students.length === 0) continue
      const page = await reader.searchNotes({ classId: cls.id, limit: 100 })
      expect(page.total).toBe(cls.noteCount)
    }
    const roster = await reader.getNoteRoster(withNotes?.id ?? '')
    expect(roster.some((entry) => entry.noteCount === 0)).toBe(true)
  })
})
