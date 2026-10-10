/**
 * The contract every NoteService must meet (FR-NTE). The mock runs it today; the Supabase
 * implementation runs the same file against a real database in CI (ENGINEERING_STANDARDS.md 2.5).
 * Each test makes the notes it needs, so it does not depend on what the fixture already holds.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The interfaces under test.
import type { Services } from '../types'

/** The classes an implementation's fixture must hold. */
export interface NotesFixture {
  // A class of a course the student is in, and that course.
  classA: string
  courseA: string
  // A class of a different course the student is in, and that course.
  classB: string
  courseB: string
  // A class the student may not file notes under (another course's, or one that doesn't exist).
  foreignClass: string
}

/** The demo's classes. */
export const MOCK_NOTES_FIXTURE: NotesFixture = {
  classA: 'swe-311-c2',
  courseA: 'swe-311',
  classB: 'cse-205-c1',
  courseB: 'cse-205',
  foreignClass: 'someone-elses-class',
}

// A well-formed ID that no record has, so databases that use UUIDs are tested with one too.
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

/** What an implementation's test file passes in. */
interface NotesContractOptions {
  /** The class IDs the fixture uses; defaults to the demo's. */
  fixture?: NotesFixture
  /** Builds a fresh note service for an enrolled student. */
  create: () => Pick<Services, 'notes'>
}

/** Behaviour every implementation of the note service shares. */
export function runNotesServiceContract(
  name: string,
  { create, fixture = MOCK_NOTES_FIXTURE }: NotesContractOptions,
) {
  /** A valid note for `classId`, with `overrides`. */
  function input(
    classId: string,
    overrides: Partial<{ title: string; contentHtml: string; tags: string[] }> = {},
  ) {
    return {
      classId,
      title: '',
      contentHtml: '<p>Measurable requirements</p><p>More</p>',
      tags: [],
      ...overrides,
    }
  }

  describe(`Notes service contract: ${name}`, () => {
    // Proves a created note is stored for its class and course, and can be read back.
    it('creates a note and reads it back', async () => {
      // Arrange.
      const { notes } = create()

      // Act.
      const created = await notes.createNote(input(fixture.classA, { tags: [' Question '] }))

      // Assert: the course comes from the class, the blank title from the first line.
      expect(created).toMatchObject({
        classId: fixture.classA,
        courseId: fixture.courseA,
        title: 'Measurable requirements',
        tags: ['Question'],
      })
      await expect(notes.getNote(created.id)).resolves.toEqual(created)
      const listed = await notes.listMyNotes({ classId: fixture.classA })
      expect(listed.map((n) => n.id)).toContain(created.id)
    })

    // Proves a typed title is kept as typed (trimmed).
    it('keeps a typed title', async () => {
      const created = await create().notes.createNote(
        input(fixture.classA, { title: '  My title ' }),
      )

      expect(created.title).toBe('My title')
    })

    // SECURITY: proves script and event-handler markup is stripped before a note is stored.
    it('stores sanitised HTML', async () => {
      // Act.
      const created = await create().notes.createNote(
        input(fixture.classA, {
          title: 'x',
          contentHtml: '<p onclick="steal()">Hi<script>steal()</script></p>',
        }),
      )

      // Assert.
      expect(created.contentHtml).toBe('<p>Hi</p>')
    })

    // Proves an edit changes the content, the class and the edit time, and keeps the creation time.
    it('updates a note, including its class', async () => {
      // Arrange.
      const { notes } = create()
      const before = await notes.createNote(input(fixture.classA))

      // Act: edit it and move it to another class.
      const after = await notes.updateNote(
        before.id,
        input(fixture.classB, { title: 'Edited', contentHtml: '<p>Changed</p>' }),
      )

      // Assert.
      expect(after).toMatchObject({
        id: before.id,
        title: 'Edited',
        classId: fixture.classB,
        courseId: fixture.courseB,
      })
      expect(after.createdAt).toBe(before.createdAt)
      expect(Date.parse(after.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before.updatedAt))
      await expect(notes.getNote(after.id)).resolves.toEqual(after)
    })

    // Proves delete is final (FR-NTE-8).
    it('deletes a note', async () => {
      // Arrange.
      const { notes } = create()
      const note = await notes.createNote(input(fixture.classA))

      // Act.
      await notes.deleteNote(note.id)

      // Assert.
      await expect(notes.getNote(note.id)).rejects.toMatchObject({ kind: 'not_found' })
      await expect(notes.deleteNote(note.id)).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves the note filters narrow the list to one course or one class.
    it('filters notes by course and by class', async () => {
      // Arrange: one note in each class.
      const { notes } = create()
      const inA = await notes.createNote(input(fixture.classA))
      const inB = await notes.createNote(input(fixture.classB))

      // Act.
      const byCourse = await notes.listMyNotes({ courseId: fixture.courseA })
      const byClass = await notes.listMyNotes({ classId: fixture.classB })

      // Assert.
      expect(byCourse.every((n) => n.courseId === fixture.courseA)).toBe(true)
      expect(byCourse.map((n) => n.id)).toContain(inA.id)
      expect(byCourse.map((n) => n.id)).not.toContain(inB.id)
      expect(byClass.every((n) => n.classId === fixture.classB)).toBe(true)
      expect(byClass.map((n) => n.id)).toContain(inB.id)
    })

    // Proves a filter that names nothing that exists lists nothing, rather than failing.
    it('lists nothing for an unknown course or class', async () => {
      const { notes } = create()

      await expect(notes.listMyNotes({ courseId: 'no-such-course' })).resolves.toEqual([])
      await expect(notes.listMyNotes({ classId: UNKNOWN_UUID })).resolves.toEqual([])
    })

    // Proves the newest edit comes first.
    it('lists the newest edit first', async () => {
      // Arrange: two notes, then an edit to the first.
      const { notes } = create()
      const first = await notes.createNote(input(fixture.classA, { title: 'first' }))
      await notes.createNote(input(fixture.classA, { title: 'second' }))
      await notes.updateNote(first.id, input(fixture.classA, { title: 'first, edited' }))

      // Act.
      const listed = await notes.listMyNotes({ classId: fixture.classA })

      // Assert.
      const times = listed.map((n) => Date.parse(n.updatedAt))
      expect(times).toEqual([...times].sort((a, b) => b - a))
      expect(listed[0]?.id).toBe(first.id)
    })

    // Proves unknown notes are not_found for every note operation, whatever the ID looks like.
    it.each(['no-such-note', UNKNOWN_UUID])(
      'reports an unknown note %s as not_found',
      async (id) => {
        const { notes } = create()
        const attempts = [
          notes.getNote(id),
          notes.updateNote(id, input(fixture.classA)),
          notes.deleteNote(id),
        ]

        await Promise.all(
          attempts.map((attempt) => expect(attempt).rejects.toMatchObject({ kind: 'not_found' })),
        )
      },
    )

    // SECURITY: proves the service applies the note rules itself, so skipping the form doesn't
    // skip them, and that a note can only be filed under one of the student's classes.
    it.each([
      ['an empty body', (id: string) => input(id, { contentHtml: '<p></p>' })],
      ['a title that is too long', (id: string) => input(id, { title: 't'.repeat(121) })],
      [
        'too many tags',
        (id: string) => input(id, { tags: Array.from({ length: 11 }, (_, i) => `t${String(i)}`) }),
      ],
      ['a repeated tag', (id: string) => input(id, { tags: ['Idea', 'idea'] })],
    ])('rejects %s as a validation error', async (_label, build) => {
      await expect(create().notes.createNote(build(fixture.classA))).rejects.toMatchObject({
        kind: 'validation',
      })
    })

    // SECURITY: proves a note cannot be filed under a class the student is not in, whether it
    // exists or not, and that the answer is the same either way.
    it.each([
      ['someone else’s class', undefined],
      ['an unknown class', 'no-such-class'],
      ['an unknown UUID', UNKNOWN_UUID],
    ])('refuses a note under %s', async (_label, classId) => {
      const { notes } = create()
      const note = await notes.createNote(input(fixture.classA))

      await expect(notes.createNote(input(classId ?? fixture.foreignClass))).rejects.toMatchObject({
        kind: 'validation',
        message: 'Choose a class from your courses.',
      })
      await expect(
        notes.updateNote(note.id, input(classId ?? fixture.foreignClass)),
      ).rejects.toMatchObject({ kind: 'validation', message: 'Choose a class from your courses.' })
    })
  })
}
