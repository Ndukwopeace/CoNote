/**
 * The contract every CourseService and ClassService must meet (FR-CRS, FR-CLS). The mock runs it
 * today; the Supabase implementation runs the same file against a real database in CI
 * (ENGINEERING_STANDARDS.md 2.5).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The error type a missing record must be.
import { AppError } from '@conote/core/errors'

// The interfaces under test.
import type { Services } from '../types'

/** What an implementation's test file passes in. */
interface CoursesAndClassesContractOptions {
  /** Builds a fresh set of services for an enrolled student with data. */
  create: () => Pick<Services, 'courses' | 'classes'>
}

// A well-formed ID that no record has, so databases that use UUIDs are tested with one too.
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

/** Behaviour every implementation of the course and class services must share. */
export function runCoursesAndClassesContract(
  name: string,
  { create }: CoursesAndClassesContractOptions,
) {
  describe(`Courses and classes contract: ${name}`, () => {
    // Proves a course read by ID matches the one in the list.
    it('reads a listed course by its ID', async () => {
      // Arrange.
      const { courses } = create()
      const [first] = await courses.listMyCourses()

      // Assert.
      expect(first).toBeDefined()
      await expect(courses.getCourse(first?.id ?? '')).resolves.toEqual(first)
    })

    // Proves unknown IDs, of any shape, become a not_found AppError, which pages turn into a
    // "not found" panel.
    it.each(['no-such-course', UNKNOWN_UUID])(
      'reports an unknown course %s as not_found',
      async (id) => {
        // Act.
        const { courses, classes } = create()
        const reads = [courses.getCourse(id), classes.listClasses(id)]

        // Assert.
        await Promise.all(
          reads.flatMap((attempt) => [
            expect(attempt).rejects.toBeInstanceOf(AppError),
            expect(attempt).rejects.toMatchObject({ kind: 'not_found' }),
          ]),
        )
      },
    )

    // Proves an unknown class is not_found too.
    it.each(['no-such-class', UNKNOWN_UUID])(
      'reports an unknown class %s as not_found',
      async (id) => {
        const attempt = create().classes.getClass(id)

        await expect(attempt).rejects.toBeInstanceOf(AppError)
        await expect(attempt).rejects.toMatchObject({ kind: 'not_found' })
      },
    )

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

    // Proves "my classes" come soonest first.
    it('lists the student’s classes soonest first', async () => {
      // Act.
      const sessions = await create().classes.listMyClasses()

      // Assert.
      const starts = sessions.map((s) => Date.parse(s.startsAt))
      expect(starts).toEqual([...starts].sort((a, b) => a - b))
    })

    // Proves a class read by ID matches the one in the list.
    it('reads a listed class by its ID', async () => {
      // Arrange.
      const { classes } = create()
      const [first] = await classes.listMyClasses()

      // Assert.
      expect(first).toBeDefined()
      await expect(classes.getClass(first?.id ?? '')).resolves.toEqual(first)
    })

    // Proves a course's counts add up: every listed class is counted on its course.
    it('counts each course’s classes', async () => {
      // Arrange.
      const { courses, classes } = create()

      // Act and assert.
      const mine = await courses.listMyCourses()
      await Promise.all(
        mine.map((course) =>
          expect(classes.listClasses(course.id)).resolves.toHaveLength(course.classCount),
        ),
      )
    })
  })
}
