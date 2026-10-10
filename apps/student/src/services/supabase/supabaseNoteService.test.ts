/**
 * Tests for the Supabase note service against a fake client: what it sends, which rules it
 * applies itself, and how it copes with refusals and bad rows.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client, and the helper that checks what was asked.
import { createFakeTables, made, type RecordedQuery, type TableAnswer } from './fakeTables'

// The service under test.
import { createSupabaseNoteService } from './supabaseNoteService'

// Made-up IDs, shaped like the database's.
const NOTE = '50000000-0000-0000-0000-000000000001'
const CLASS = '30000000-0000-0000-0000-000000000001'
const COURSE = '20000000-0000-0000-0000-000000000001'
const STUDENT = '10000000-0000-0000-0000-000000000004'

/** A note row as the database returns it. */
function noteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE,
    student_id: STUDENT,
    course_id: COURSE,
    class_id: CLASS,
    title: 'Vector basics',
    content_html: '<p>Vectors have a magnitude.</p>',
    tags: ['definition'],
    created_at: '2026-10-01T09:00:00+00:00',
    updated_at: '2026-10-02T09:00:00+00:00',
    ...overrides,
  }
}

/** A valid note submission, with overrides. */
function submission(overrides: Record<string, unknown> = {}) {
  return {
    classId: CLASS,
    title: '',
    contentHtml: '<p>Vectors have a magnitude.</p>',
    tags: [],
    ...overrides,
  }
}

/** What each kind of call answers. */
interface Answers {
  // Reading notes (list or one).
  read: TableAnswer
  // The class lookup that tells which course a class is in.
  klass: TableAnswer
  insert: TableAnswer
  update: TableAnswer
  remove: TableAnswer
}

/** Builds the service over a fake client that answers from `answers`. */
function setup(overrides: Partial<Answers> = {}) {
  const answers: Answers = {
    read: { data: [noteRow()], error: null },
    klass: { data: { id: CLASS, course_id: COURSE }, error: null },
    insert: { data: noteRow(), error: null },
    update: { data: [noteRow({ title: 'Edited' })], error: null },
    remove: { data: [{ id: NOTE }], error: null },
    ...overrides,
  }
  const { client, queries } = createFakeTables((query: RecordedQuery) => {
    if (query.table === 'class_sessions') return answers.klass
    if (query.table !== 'notes') throw new Error(`Unexpected table ${query.table}`)
    const has = (method: string) => query.calls.some(([name]) => name === method)
    if (has('insert')) return answers.insert
    if (has('update')) return answers.update
    if (has('delete')) return answers.remove
    return answers.read
  })
  return { service: createSupabaseNoteService({ client }), queries }
}

/** The payload of the first write of `method` that was made. */
function sent(queries: RecordedQuery[], method: string) {
  return queries
    .find((q) => q.calls.some(([name]) => name === method))
    ?.calls.find(([name]) => name === method)?.[1]
}

describe('Supabase note service: reading', () => {
  // Proves rows become notes, newest edit first, and a missing title is left out.
  it('lists the student’s notes, newest edit first', async () => {
    const { service, queries } = setup({
      read: {
        data: [noteRow(), noteRow({ id: '50000000-0000-0000-0000-000000000002', title: null })],
        error: null,
      },
    })

    const notes = await service.listMyNotes()

    expect(notes[0]).toEqual({
      id: NOTE,
      studentId: STUDENT,
      courseId: COURSE,
      classId: CLASS,
      title: 'Vector basics',
      contentHtml: '<p>Vectors have a magnitude.</p>',
      tags: ['definition'],
      createdAt: '2026-10-01T09:00:00+00:00',
      updatedAt: '2026-10-02T09:00:00+00:00',
    })
    expect(notes[1]).not.toHaveProperty('title')
    expect(made(queries[0]!, 'order', 'updated_at', { ascending: false })).toBe(true)
  })

  // Proves the filters are passed as exact matches.
  it('filters by course and class', async () => {
    const { service, queries } = setup()

    await service.listMyNotes({ courseId: COURSE, classId: CLASS })

    expect(made(queries[0]!, 'eq', 'course_id', COURSE)).toBe(true)
    expect(made(queries[0]!, 'eq', 'class_id', CLASS)).toBe(true)
  })

  // SECURITY: proves a filter that is not a UUID never reaches a query.
  it('lists nothing, without asking, for a filter that is not a UUID', async () => {
    const { service, queries } = setup()

    await expect(service.listMyNotes({ courseId: 'x,id.neq.0' })).resolves.toEqual([])
    await expect(service.listMyNotes({ classId: 'no-such-class' })).resolves.toEqual([])
    expect(queries).toHaveLength(0)
  })

  // Proves one note is read by ID, and a missing one is not_found.
  it('reads one note, or reports it as not_found', async () => {
    const found = setup({ read: { data: noteRow(), error: null } })
    await expect(found.service.getNote(NOTE)).resolves.toMatchObject({ id: NOTE })
    expect(made(found.queries[0]!, 'eq', 'id', NOTE)).toBe(true)

    const missing = setup({ read: { data: null, error: null } })
    await expect(missing.service.getNote(NOTE)).rejects.toMatchObject({ kind: 'not_found' })
  })

  // SECURITY: proves an ID that is not a UUID is refused before any query is built from it.
  it('refuses a note ID that is not a UUID without asking the database', async () => {
    const { service, queries } = setup()

    await expect(service.getNote('no-such-note')).rejects.toMatchObject({ kind: 'not_found' })
    await expect(service.updateNote('x', submission())).rejects.toMatchObject({ kind: 'not_found' })
    await expect(service.deleteNote('x')).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries).toHaveLength(0)
  })

  // Proves refusals and malformed rows become AppErrors.
  it('turns refusals and malformed rows into AppErrors', async () => {
    const refused = setup({ read: { data: null, error: { code: '42501', message: 'denied' } } })
    await expect(refused.service.listMyNotes()).rejects.toMatchObject({ kind: 'forbidden' })

    const malformed = setup({ read: { data: [noteRow({ tags: 'not-a-list' })], error: null } })
    await expect(malformed.service.listMyNotes()).rejects.toMatchObject({ kind: 'unknown' })
  })
})

describe('Supabase note service: writing', () => {
  // Proves a new note sends the class's course, a resolved title and clean HTML, and no author.
  it('creates a note from the class’s course', async () => {
    const { service, queries } = setup()

    const created = await service.createNote(submission({ tags: [' Question '] }))

    expect(created.id).toBe(NOTE)
    // SECURITY: no student ID is sent; the database fills in the signed-in student.
    expect(sent(queries, 'insert')).toEqual({
      class_id: CLASS,
      course_id: COURSE,
      title: 'Vectors have a magnitude.',
      content_html: '<p>Vectors have a magnitude.</p>',
      tags: ['Question'],
    })
  })

  // SECURITY: proves markup is cleaned before it is sent for storage.
  it('sends sanitised HTML', async () => {
    const { service, queries } = setup()

    await service.createNote(
      submission({
        title: 'x',
        contentHtml: '<p onclick="steal()">Hi<script>steal()</script></p>',
      }),
    )

    expect(sent(queries, 'insert')).toMatchObject({ content_html: '<p>Hi</p>' })
  })

  // SECURITY: proves the note rules are applied here, with no query made for a bad note.
  it.each([
    ['an empty body', { contentHtml: '<p></p>' }],
    ['a long title', { title: 't'.repeat(121) }],
    ['too many tags', { tags: Array.from({ length: 11 }, (_, i) => `t${String(i)}`) }],
  ])('rejects %s before asking the database', async (_label, overrides) => {
    const { service, queries } = setup()

    await expect(service.createNote(submission(overrides))).rejects.toMatchObject({
      kind: 'validation',
    })
    expect(queries).toHaveLength(0)
  })

  // SECURITY: proves a class that is not the student's (or not a UUID, or hidden) is refused alike.
  it.each([
    ['not a UUID', 'no-such-class', { data: { id: CLASS, course_id: COURSE }, error: null }],
    ['hidden by Row Level Security', CLASS, { data: null, error: null }],
  ])('refuses a class that is %s', async (_label, classId, klass) => {
    const { service } = setup({ klass })

    const message = 'Choose a class from your courses.'
    await expect(service.createNote(submission({ classId }))).rejects.toMatchObject({
      kind: 'validation',
      message,
    })
    await expect(service.updateNote(NOTE, submission({ classId }))).rejects.toMatchObject({
      kind: 'validation',
      message,
    })
  })

  // Proves the database refusing the write (the course closed meanwhile) reads as the same message.
  it('turns a refused write into the class message', async () => {
    const { service } = setup({
      insert: { data: null, error: { code: '42501', message: 'row-level security' } },
    })

    await expect(service.createNote(submission())).rejects.toMatchObject({
      kind: 'validation',
      message: 'Choose a class from your courses.',
    })
  })

  // Proves an edit is limited to one note and sends the same fields as a create.
  it('updates one note', async () => {
    const { service, queries } = setup()

    const updated = await service.updateNote(NOTE, submission({ title: 'Edited' }))

    expect(updated.title).toBe('Edited')
    const write = queries.find((q) => q.calls.some(([name]) => name === 'update'))!
    expect(made(write, 'eq', 'id', NOTE)).toBe(true)
    expect(sent(queries, 'update')).toMatchObject({
      class_id: CLASS,
      course_id: COURSE,
      title: 'Edited',
    })
  })

  // Proves an edit that changes no row (not the student's, or deleted) is not_found.
  it('reports an edit or delete that changes nothing as not_found', async () => {
    const edit = setup({ update: { data: [], error: null } })
    await expect(edit.service.updateNote(NOTE, submission())).rejects.toMatchObject({
      kind: 'not_found',
    })

    const remove = setup({ remove: { data: [], error: null } })
    await expect(remove.service.deleteNote(NOTE)).rejects.toMatchObject({ kind: 'not_found' })
  })

  // Proves delete is limited to one note.
  it('deletes one note', async () => {
    const { service, queries } = setup()

    await expect(service.deleteNote(NOTE)).resolves.toBeUndefined()

    const write = queries.find((q) => q.calls.some(([name]) => name === 'delete'))!
    expect(made(write, 'eq', 'id', NOTE)).toBe(true)
  })
})
