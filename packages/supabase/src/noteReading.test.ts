/**
 * Tests for reading students' notes on Supabase (D123): what is sent to the two database functions,
 * how their rows become notes, and how a refusal becomes an error. The real rules (who may read
 * what) live in the database and are tested there and in the integration tests.
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// The unit under test.
import { createSupabaseNoteReader } from './noteReading'

const CLASS = '30000000-0000-0000-0000-000000000005'
const COURSE = '20000000-0000-0000-0000-000000000001'
const STUDENT = '10000000-0000-0000-0000-000000000004'

/** One row as `search_notes` returns it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    note_id: 'n1',
    class_id: CLASS,
    class_number: 3,
    class_title: 'Eigenvalues',
    course_id: COURSE,
    course_code: 'MTH 202',
    course_title: 'Linear Algebra',
    student_id: STUDENT,
    student_name: 'Ada Student',
    student_number: null,
    note_title: 'Mine',
    content_html: '<p>text</p>',
    created_at: '2026-11-02T10:00:00Z',
    updated_at: '2026-11-02T10:05:00Z',
    total_count: 7,
    ...overrides,
  }
}

/** A client whose `rpc` answers with `answer`; the calls are kept in `rpc.mock.calls`. */
function clientAnswering(answer: { data: unknown; error: unknown }) {
  const rpc = vi.fn<(name: string, args?: Record<string, unknown>) => Promise<typeof answer>>(() =>
    Promise.resolve(answer),
  )
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

describe('searchNotes', () => {
  // Proves the query is sent as the function's arguments, with unset filters as null, and the rows
  // come back as notes with the total from the first row.
  it('sends the filters and reads the page', async () => {
    const { client, rpc } = clientAnswering({ data: [row(), row({ note_id: 'n2' })], error: null })

    const page = await createSupabaseNoteReader({ client }).searchNotes({
      classId: CLASS,
      studentText: 'ada',
      limit: 20,
      offset: 40,
    })

    expect(rpc).toHaveBeenCalledWith('search_notes', {
      p_course: null,
      p_class: CLASS,
      p_student_id: null,
      p_student_text: 'ada',
      p_limit: 20,
      p_offset: 40,
    })
    expect(page.total).toBe(7)
    expect(page.notes).toHaveLength(2)
    expect(page.notes[0]).toEqual({
      id: 'n1',
      classId: CLASS,
      classNumber: 3,
      classTitle: 'Eigenvalues',
      courseId: COURSE,
      courseCode: 'MTH 202',
      courseTitle: 'Linear Algebra',
      studentId: STUDENT,
      studentName: 'Ada Student',
      studentNumber: null,
      title: 'Mine',
      contentHtml: '<p>text</p>',
      createdAt: '2026-11-02T10:00:00Z',
      updatedAt: '2026-11-02T10:05:00Z',
    })
  })

  // Proves no matches is an empty page with a zero total, not an error.
  it('answers an empty page when nothing matches', async () => {
    const { client } = clientAnswering({ data: [], error: null })

    await expect(createSupabaseNoteReader({ client }).searchNotes({})).resolves.toEqual({
      notes: [],
      total: 0,
    })
  })

  // SECURITY: proves an ID that is not a UUID never reaches the database.
  it('turns a malformed ID away before calling', async () => {
    const { client, rpc } = clientAnswering({ data: [], error: null })
    const reader = createSupabaseNoteReader({ client })

    await expect(reader.searchNotes({ courseId: 'x; drop table notes' })).rejects.toMatchObject({
      kind: 'validation',
    })
    await expect(reader.searchNotes({ studentId: '1' })).rejects.toMatchObject({
      kind: 'validation',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  // Proves the database's refusal for a student, a visitor or a teacher's other course is an error
  // the screens already handle, and that a row of the wrong shape is refused rather than shown.
  it('reports a refusal and refuses a malformed row', async () => {
    const refused = clientAnswering({ data: null, error: { code: '42501', message: 'forbidden' } })
    await expect(
      createSupabaseNoteReader({ client: refused.client }).searchNotes({}),
    ).rejects.toMatchObject({
      kind: 'forbidden',
    })

    const broken = clientAnswering({ data: [row({ student_name: 5 })], error: null })
    await expect(
      createSupabaseNoteReader({ client: broken.client }).searchNotes({}),
    ).rejects.toBeInstanceOf(Error)
  })
})

describe('getNoteRoster', () => {
  // Proves the roster is read for one class and its rows become entries.
  it('reads who wrote and how many notes', async () => {
    const { client, rpc } = clientAnswering({
      data: [
        { student_id: STUDENT, student_name: 'Ada', student_number: 'U1', note_count: 2 },
        { student_id: 'x', student_name: 'Bo', student_number: null, note_count: 0 },
      ],
      error: null,
    })

    const roster = await createSupabaseNoteReader({ client }).getNoteRoster(CLASS)

    expect(rpc).toHaveBeenCalledWith('class_note_roster', { p_class: CLASS })
    expect(roster).toEqual([
      { studentId: STUDENT, studentName: 'Ada', studentNumber: 'U1', noteCount: 2 },
      { studentId: 'x', studentName: 'Bo', studentNumber: null, noteCount: 0 },
    ])
  })

  // SECURITY: proves a malformed class ID is "not found" and is never sent.
  it('answers not found for a malformed class ID without calling', async () => {
    const { client, rpc } = clientAnswering({ data: [], error: null })

    await expect(createSupabaseNoteReader({ client }).getNoteRoster('nope')).rejects.toMatchObject({
      kind: 'not_found',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  // Proves the database's "not found" and "not yours" come through as those errors.
  it('reports an unknown class and a class the teacher does not teach', async () => {
    const unknown = clientAnswering({ data: null, error: { code: 'P0002', message: 'x' } })
    await expect(
      createSupabaseNoteReader({ client: unknown.client }).getNoteRoster(CLASS),
    ).rejects.toMatchObject({
      kind: 'not_found',
    })
    const other = clientAnswering({ data: null, error: { code: '42501', message: 'x' } })
    await expect(
      createSupabaseNoteReader({ client: other.client }).getNoteRoster(CLASS),
    ).rejects.toMatchObject({
      kind: 'forbidden',
    })
  })
})
