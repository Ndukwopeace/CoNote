/**
 * The contract every note, summary and notification service must meet (courses and classes have
 * their own, in coursesAndClasses.contract.ts). The mock runs it today; the Supabase
 * implementation runs the same file when its slice lands (ENGINEERING_STANDARDS.md 2.5).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The interfaces under test.
import type { Services } from '../types'

/** What an implementation's test file passes in. */
interface CatalogContractOptions {
  /** Builds a fresh set of services for an enrolled student with data. */
  create: () => Pick<Services, 'classes' | 'notes' | 'summaries' | 'notifications'>
}

/** Behaviour every implementation of the read-only catalog services must share. */
export function runCatalogServicesContract(name: string, { create }: CatalogContractOptions) {
  describe(`Catalog services contract: ${name}`, () => {
    // Proves the note filters narrow the list to one course or one class.
    it('filters notes by course and by class', async () => {
      // Arrange.
      const { notes } = create()
      const all = await notes.listMyNotes()
      const sample = all[0]

      // Act.
      const byCourse = await notes.listMyNotes({ courseId: sample?.courseId ?? '' })
      const byClass = await notes.listMyNotes({ classId: sample?.classId ?? '' })

      // Assert.
      expect(byCourse.length).toBeGreaterThan(0)
      expect(byCourse.every((n) => n.courseId === sample?.courseId)).toBe(true)
      expect(byClass.every((n) => n.classId === sample?.classId)).toBe(true)
    })

    // SECURITY: proves only summaries of published classes are ever returned (section 4).
    it('returns summaries only for published classes', async () => {
      // Arrange.
      const services = create()
      const summaries = await services.summaries.listPublished()

      // Assert: each summary's class is published.
      for (const summary of summaries) {
        const session = await services.classes.getClass(summary.classId)
        expect(session.summaryStatus).toBe('published')
      }
    })

    // Proves a created note is stored for its class and course, and can be read back.
    it('creates a note and reads it back', async () => {
      // Arrange.
      const { notes } = create()

      // Act.
      const created = await notes.createNote({
        classId: 'swe-311-c2',
        title: '',
        contentHtml: '<p>Measurable requirements</p><p>More</p>',
        tags: [' Question '],
      })

      // Assert: the course comes from the class, the blank title from the first line.
      expect(created.courseId).toBe('swe-311')
      expect(created.title).toBe('Measurable requirements')
      expect(created.tags).toEqual(['Question'])
      await expect(notes.getNote(created.id)).resolves.toEqual(created)
      expect((await notes.listMyNotes({ classId: 'swe-311-c2' })).map((n) => n.id)).toContain(
        created.id,
      )
    })

    // SECURITY: proves script and event-handler markup is stripped before a note is stored.
    it('stores sanitised HTML', async () => {
      // Act.
      const created = await create().notes.createNote({
        classId: 'swe-311-c2',
        title: 'x',
        contentHtml: '<p onclick="steal()">Hi<script>steal()</script></p>',
        tags: [],
      })

      // Assert.
      expect(created.contentHtml).toBe('<p>Hi</p>')
    })

    // Proves an edit changes the content and the edit time, and keeps the creation time.
    it('updates a note', async () => {
      // Arrange.
      const { notes } = create()
      const [before] = await notes.listMyNotes()

      // Act.
      const after = await notes.updateNote(before?.id ?? '', {
        classId: before?.classId ?? '',
        title: 'Edited',
        contentHtml: '<p>Changed</p>',
        tags: [],
      })

      // Assert.
      expect(after.title).toBe('Edited')
      expect(after.createdAt).toBe(before?.createdAt)
      expect(Date.parse(after.updatedAt)).toBeGreaterThanOrEqual(
        Date.parse(before?.updatedAt ?? ''),
      )
      await expect(notes.getNote(after.id)).resolves.toEqual(after)
    })

    // Proves delete is final (FR-NTE-8).
    it('deletes a note', async () => {
      // Arrange.
      const { notes } = create()
      const [first] = await notes.listMyNotes()

      // Act.
      await notes.deleteNote(first?.id ?? '')

      // Assert.
      await expect(notes.getNote(first?.id ?? '')).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves unknown notes are not_found for every note operation.
    it.each([
      ['read', (s: ReturnType<typeof create>) => s.notes.getNote('no-such-note')],
      [
        'update',
        (s: ReturnType<typeof create>) =>
          s.notes.updateNote('no-such-note', {
            classId: 'swe-311-c1',
            title: '',
            contentHtml: '<p>x</p>',
            tags: [],
          }),
      ],
      ['delete', (s: ReturnType<typeof create>) => s.notes.deleteNote('no-such-note')],
    ])('reports an unknown note as not_found on %s', async (_label, act) => {
      await expect(act(create())).rejects.toMatchObject({ kind: 'not_found' })
    })

    // SECURITY: proves the service applies the note rules itself, so skipping the form doesn't
    // skip them, and that a note can only be filed under one of the student's classes.
    it.each([
      ['an empty body', { classId: 'swe-311-c1', title: '', contentHtml: '<p></p>', tags: [] }],
      [
        'an unknown class',
        { classId: 'no-such-class', title: '', contentHtml: '<p>x</p>', tags: [] },
      ],
      [
        'too many tags',
        {
          classId: 'swe-311-c1',
          title: '',
          contentHtml: '<p>x</p>',
          tags: Array.from({ length: 11 }, (_, i) => `t${String(i)}`),
        },
      ],
    ])('rejects %s as a validation error', async (_label, input) => {
      await expect(create().notes.createNote(input)).rejects.toMatchObject({ kind: 'validation' })
    })

    // Proves a published summary can be read by its class.
    it('reads a published summary by class', async () => {
      // Arrange.
      const { summaries } = create()
      const [first] = await summaries.listPublished()

      // Act and assert.
      await expect(summaries.getByClass(first?.classId ?? '')).resolves.toEqual(first)
    })

    // SECURITY: proves a class whose summary isn't published returns not_found, never a draft.
    it.each(['swe-311-c3', 'cse-205-c1', 'swe-311-c4', 'no-such-class'])(
      'reports the summary of %s as not_found',
      async (classId) => {
        await expect(create().summaries.getByClass(classId)).rejects.toMatchObject({
          kind: 'not_found',
        })
      },
    )

    // Proves marking a summary as viewed sticks (FR-SUM-5).
    it('marks a summary as viewed', async () => {
      // Arrange.
      const { summaries } = create()
      const unviewed = (await summaries.listPublished()).find((s) => !s.viewedByMe)

      // Act.
      await summaries.markViewed(unviewed?.id ?? '')

      // Assert.
      const after = await summaries.getByClass(unviewed?.classId ?? '')
      expect(after.viewedByMe).toBe(true)
      await expect(summaries.markViewed('no-such-summary')).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // Proves reading one notification lowers the unread count (FR-NTF-3, FR-NTF-5).
    it('marks a notification as read', async () => {
      // Arrange.
      const { notifications } = create()
      const before = await notifications.unreadCount()
      const unread = (await notifications.list()).find((n) => !n.read)

      // Act.
      await notifications.markRead(unread?.id ?? '')

      // Assert.
      await expect(notifications.unreadCount()).resolves.toBe(before - 1)
      expect((await notifications.list()).find((n) => n.id === unread?.id)?.read).toBe(true)
      await expect(notifications.markRead('no-such-notification')).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // Proves "Mark all as read" clears the count (FR-NTF-3).
    it('marks every notification as read', async () => {
      // Arrange.
      const { notifications } = create()

      // Act.
      await notifications.markAllRead()

      // Assert.
      await expect(notifications.unreadCount()).resolves.toBe(0)
    })

    // Proves the unread count matches the unread notifications in the list.
    it('counts unread notifications', async () => {
      // Arrange.
      const { notifications } = create()
      const list = await notifications.list()

      // Assert.
      await expect(notifications.unreadCount()).resolves.toBe(list.filter((n) => !n.read).length)
    })
  })
}
