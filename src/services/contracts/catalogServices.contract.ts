/**
 * The contract every course, class, note, summary and notification service must meet. The mock
 * runs it today; the Supabase implementation runs the same file in the backend stage
 * (ENGINEERING_STANDARDS.md 2.5).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The error type a missing record must be.
import { AppError } from '@/lib/errors'

// The interfaces under test.
import type { Services } from '../types'

/** What an implementation's test file passes in. */
interface CatalogContractOptions {
  /** Builds a fresh set of services for an enrolled student with data. */
  create: () => Pick<Services, 'courses' | 'classes' | 'notes' | 'summaries' | 'notifications'>
}

/** Behaviour every implementation of the read-only catalog services must share. */
export function runCatalogServicesContract(name: string, { create }: CatalogContractOptions) {
  describe(`Catalog services contract: ${name}`, () => {
    // Proves a course read by ID matches the one in the list.
    it('reads a listed course by its ID', async () => {
      // Arrange.
      const { courses } = create()
      const [first] = await courses.listMyCourses()

      // Assert.
      expect(first).toBeDefined()
      await expect(courses.getCourse(first?.id ?? '')).resolves.toEqual(first)
    })

    // Proves unknown IDs become a not_found AppError, which pages turn into a "not found" panel.
    it.each([
      ['course', (s: ReturnType<typeof create>) => s.courses.getCourse('no-such-course')],
      ['class', (s: ReturnType<typeof create>) => s.classes.getClass('no-such-class')],
      ['course classes', (s: ReturnType<typeof create>) => s.classes.listClasses('no-such-course')],
    ])('reports an unknown %s as not_found', async (_label, read) => {
      // Act.
      const attempt = read(create())

      // Assert.
      await expect(attempt).rejects.toBeInstanceOf(AppError)
      await expect(attempt).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves a course's classes all belong to it and come in class-number order.
    it("lists a course's classes in number order", async () => {
      // Arrange.
      const services = create()
      const [course] = await services.courses.listMyCourses()

      // Act.
      const sessions = await services.classes.listClasses(course?.id ?? '')

      // Assert.
      expect(sessions.every((s) => s.courseId === course?.id)).toBe(true)
      expect(sessions.map((s) => s.number)).toEqual(
        [...sessions.map((s) => s.number)].sort((a, b) => a - b),
      )
    })

    // Proves "my classes" only includes classes of enrolled courses.
    it('lists only classes of enrolled courses', async () => {
      // Arrange.
      const services = create()
      const enrolled = new Set((await services.courses.listMyCourses()).map((c) => c.id))

      // Act.
      const sessions = await services.classes.listMyClasses()

      // Assert.
      expect(sessions.length).toBeGreaterThan(0)
      expect(sessions.every((s) => enrolled.has(s.courseId))).toBe(true)
    })

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
