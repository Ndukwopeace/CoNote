/**
 * Tests for the pieces the teacher and admin apps share when they read students' notes (D123): the
 * search the demo data uses, and the counts shown above a class's notes.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import {
  NOTES_PAGE_SIZE,
  rosterSummary,
  searchNoteEntries,
  type NoteEntry,
  type NoteRosterEntry,
} from './noteReading'

/** One note, with the fields a test cares about overridden. */
function note(overrides: Partial<NoteEntry> & { id: string }): NoteEntry {
  return {
    classId: 'k1',
    classNumber: 1,
    classTitle: 'Vectors',
    courseId: 'c1',
    courseCode: 'MTH 202',
    courseTitle: 'Linear Algebra',
    studentId: 's1',
    studentName: 'Ada Student',
    studentNumber: 'U2026/0001',
    title: null,
    contentHtml: '<p>text</p>',
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
    ...overrides,
  }
}

const NOTES = [
  note({ id: 'n1', createdAt: '2026-11-02T10:00:00Z' }),
  note({
    id: 'n2',
    studentId: 's2',
    studentName: 'Bo Learner',
    studentNumber: null,
    createdAt: '2026-11-02T11:00:00Z',
  }),
  note({
    id: 'n3',
    classId: 'k2',
    courseId: 'c2',
    courseCode: 'PHY 101',
    studentId: 's1',
    createdAt: '2026-11-03T09:00:00Z',
  }),
]

describe('searchNoteEntries', () => {
  // Proves the newest note comes first and the total counts every match.
  it('lists matches newest first with the total', () => {
    const page = searchNoteEntries(NOTES, {})
    expect(page.notes.map((entry) => entry.id)).toEqual(['n3', 'n2', 'n1'])
    expect(page.total).toBe(3)
  })

  // Proves each filter narrows the list: course, class and exact student.
  it('filters by course, class and student', () => {
    expect(searchNoteEntries(NOTES, { courseId: 'c2' }).notes.map((e) => e.id)).toEqual(['n3'])
    expect(searchNoteEntries(NOTES, { classId: 'k1' }).total).toBe(2)
    expect(searchNoteEntries(NOTES, { studentId: 's2' }).notes.map((e) => e.id)).toEqual(['n2'])
  })

  // Proves the text search matches part of a name or a student number, ignoring case, and that a
  // percent sign is plain text, as in the database.
  it('searches students by part of the name or number, as plain text', () => {
    expect(searchNoteEntries(NOTES, { studentText: 'LEARN' }).total).toBe(1)
    expect(searchNoteEntries(NOTES, { studentText: 'u2026/0001' }).total).toBe(2)
    expect(searchNoteEntries(NOTES, { studentText: '%' }).total).toBe(0)
    expect(searchNoteEntries(NOTES, { studentText: '   ' }).total).toBe(3)
  })

  // Proves paging: a page holds at most the limit, the total stays whole, and the offset moves on.
  it('pages the result and keeps the total', () => {
    const first = searchNoteEntries(NOTES, { limit: 2, offset: 0 })
    const second = searchNoteEntries(NOTES, { limit: 2, offset: 2 })
    expect(first.notes.map((e) => e.id)).toEqual(['n3', 'n2'])
    expect(second.notes.map((e) => e.id)).toEqual(['n1'])
    expect(first.total).toBe(3)
    expect(second.total).toBe(3)
  })

  // Proves a page is capped like the database caps it, and defaults to the page size.
  it('caps an oversized limit and uses the page size by default', () => {
    const many = Array.from({ length: 150 }, (_, index) => note({ id: `m${String(index)}` }))
    expect(searchNoteEntries(many, {}).notes).toHaveLength(NOTES_PAGE_SIZE)
    expect(searchNoteEntries(many, { limit: 100_000 }).notes).toHaveLength(100)
    expect(searchNoteEntries(many, { limit: 0 }).notes).toHaveLength(1)
  })
})

describe('rosterSummary', () => {
  const roster: NoteRosterEntry[] = [
    { studentId: 's1', studentName: 'Ada', studentNumber: null, noteCount: 3 },
    { studentId: 's2', studentName: 'Bo', studentNumber: null, noteCount: 0 },
    { studentId: 's3', studentName: 'Cy', studentNumber: null, noteCount: 1 },
  ]

  // Proves the three numbers of "4 notes from 2 of 3 students", and who has not written.
  it('counts notes, students who wrote and students enrolled', () => {
    expect(rosterSummary(roster)).toEqual({
      notes: 4,
      writers: 2,
      students: 3,
      silent: [roster[1]],
    })
  })

  // Proves an empty roster gives zeros, not an error.
  it('is all zeros for no students', () => {
    expect(rosterSummary([])).toEqual({ notes: 0, writers: 0, students: 0, silent: [] })
  })
})
