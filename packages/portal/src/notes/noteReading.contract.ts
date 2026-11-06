/**
 * The behaviour every implementation of `NoteReadingService` shares (D123), run against the demo
 * services of the teacher and admin apps and, in CI, against the real database. Each caller says
 * which class and student the fixture has; the contract checks the rules around them.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The service under test.
import type { NoteReadingService } from '@conote/core/noteReading'

/** What the implementation's data holds, for the signed-in reader. */
export interface NoteReadingFixture {
  // A class the reader may read, and its course.
  classId: string
  courseId: string
  // How many notes that class has, how many students wrote them, and how many are on its roster.
  notes: number
  writers: number
  students: number
  // One student who wrote in that class, and text that matches that student's name and no other's.
  studentId: string
  studentText: string
  // A well-formed ID that no class has.
  unknownClassId: string
  // A class and course the reader may NOT read (another teacher's), when the fixture has one.
  foreignClassId?: string
  foreignCourseId?: string
}

/** What an implementation's test file passes in. */
interface NoteReadingContractOptions {
  fixture: NoteReadingFixture
  // Builds the service, signed in as the reader the fixture describes.
  create: () => NoteReadingService
}

/** Behaviour every implementation of the note reading service shares. */
export function runNoteReadingContract(
  name: string,
  { fixture, create }: Readonly<NoteReadingContractOptions>,
) {
  describe(`${name} note reading service`, () => {
    // Proves a class's notes come back newest first, all of them, each from its own class.
    it('lists the notes of a class, newest first', async () => {
      const page = await create().searchNotes({ classId: fixture.classId, limit: 100 })

      expect(page.total).toBe(fixture.notes)
      expect(page.notes).toHaveLength(fixture.notes)
      expect(page.notes.every((entry) => entry.classId === fixture.classId)).toBe(true)
      const times = page.notes.map((entry) => Date.parse(entry.createdAt))
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })

    // Proves a page holds at most the limit while the total stays whole, and the offset moves on.
    it('pages the notes and keeps the total', async () => {
      const notes = create()
      const first = await notes.searchNotes({ classId: fixture.classId, limit: 1, offset: 0 })
      const second = await notes.searchNotes({ classId: fixture.classId, limit: 1, offset: 1 })

      expect(first.notes).toHaveLength(1)
      expect(first.total).toBe(fixture.notes)
      expect(second.total).toBe(fixture.notes)
      if (fixture.notes > 1) expect(second.notes[0]?.id).not.toBe(first.notes[0]?.id)
    })

    // Proves the filters narrow the list: by exact student, and by part of a name.
    it('narrows by student', async () => {
      const notes = create()
      const exact = await notes.searchNotes({
        classId: fixture.classId,
        studentId: fixture.studentId,
      })
      const byText = await notes.searchNotes({
        classId: fixture.classId,
        studentText: fixture.studentText,
      })

      expect(exact.total).toBeGreaterThan(0)
      expect(exact.notes.every((entry) => entry.studentId === fixture.studentId)).toBe(true)
      expect(byText.notes.map((entry) => entry.id).sort((a, b) => a.localeCompare(b))).toEqual(
        exact.notes.map((entry) => entry.id).sort((a, b) => a.localeCompare(b)),
      )
    })

    // Proves a percent sign is plain text, so it cannot be used to match every student.
    it('treats a percent sign as plain text', async () => {
      const page = await create().searchNotes({ classId: fixture.classId, studentText: '%' })

      expect(page.total).toBe(0)
    })

    // Proves the roster counts add up to the class's notes, in name order.
    it('says who wrote how many notes', async () => {
      const roster = await create().getNoteRoster(fixture.classId)

      expect(roster).toHaveLength(fixture.students)
      expect(roster.reduce((sum, entry) => sum + entry.noteCount, 0)).toBe(fixture.notes)
      expect(roster.filter((entry) => entry.noteCount > 0)).toHaveLength(fixture.writers)
      const names = roster.map((entry) => entry.studentName)
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    })

    // Proves an unknown class is "not found".
    it('answers not found for a class that does not exist', async () => {
      await expect(create().getNoteRoster(fixture.unknownClassId)).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // SECURITY: proves a reader gets nothing of a class they may not read: no notes in a search
    // and a refusal for its roster.
    it('refuses what the reader may not read', async () => {
      if (!fixture.foreignClassId || !fixture.foreignCourseId) return
      const notes = create()

      const page = await notes.searchNotes({ courseId: fixture.foreignCourseId })

      expect(page.total).toBe(0)
      await expect(notes.getNoteRoster(fixture.foreignClassId)).rejects.toMatchObject({
        kind: 'forbidden',
      })
    })
  })
}
