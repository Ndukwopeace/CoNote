/**
 * Tests for the teacher demo's note reading service (D123): the shared contract, plus what is
 * specific to the demo: a signed-out visitor, and the demo's own counts.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared contract every implementation meets.
import { runNoteReadingContract } from '@conote/portal/testing'

import { createMockNoteReadingService } from './mockNoteReadingService'
import { createPlatformSeed } from './seed/platformSeed'

/** The service as the demo teacher, or as nobody. */
function create(actor: string | null = 'teacher-1') {
  return createMockNoteReadingService({
    data: createPlatformSeed(new Date()),
    actorId: () => actor,
    latencyMs: 0,
  })
}

// MTH 202 class 4 has 21 notes from 12 of the 14 students (the seed's rule: two always write none).
runNoteReadingContract('teacher demo', {
  create: () => create(),
  fixture: {
    classId: 'mth-202-4',
    courseId: 'mth-202',
    notes: 21,
    writers: 12,
    students: 14,
    studentId: 'demo-student-1',
    studentText: 'Ada Okafor',
    unknownClassId: 'no-such-class',
    foreignClassId: 'swe-311-1',
    foreignCourseId: 'swe-311',
  },
})

describe('teacher demo note reading', () => {
  // SECURITY: proves nobody who is signed out can read a note or a roster.
  it('refuses a visitor who is not signed in', async () => {
    const visitor = create(null)

    await expect(visitor.searchNotes({})).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(visitor.getNoteRoster('mth-202-4')).rejects.toMatchObject({ kind: 'unauthorized' })
  })

  // Proves the demo's summaries and its notes tell one story: the review screen's counts equal
  // what the notes say.
  it('agrees with the counts on the review screen', async () => {
    const seed = createPlatformSeed(new Date())
    const reader = createMockNoteReadingService({
      data: seed,
      actorId: () => 'teacher-1',
      latencyMs: 0,
    })
    const summary = seed.summaries.find((item) => item.classId === 'mth-202-5')

    const roster = await reader.getNoteRoster('mth-202-5')

    expect(roster.reduce((sum, entry) => sum + entry.noteCount, 0)).toBe(
      summary?.notesAnalyzedCount,
    )
    expect(roster.filter((entry) => entry.noteCount > 0)).toHaveLength(summary?.studentCount ?? -1)
  })
})
