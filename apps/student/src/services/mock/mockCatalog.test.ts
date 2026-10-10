/**
 * Tests for the demo course, class, note, summary and notification services.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared contract.
import { runCatalogServicesContract } from '../contracts/catalogServices.contract'

// The implementation under test, and the seed it serves.
import { createMockCatalog } from './mockCatalog'
import { createSeed } from './seed'

/** Demo services over a fresh seed, with no delay. */
function createCatalog() {
  return createMockCatalog({ seed: createSeed(new Date()), latencyMs: 0 })
}

// Run the shared contract against the mock.
runCatalogServicesContract('mock', { create: createCatalog })

describe('mock catalog services', () => {
  // Proves the lists are sorted the way the pages show them.
  it('lists newest notes and notifications first', async () => {
    // Arrange.
    const catalog = createCatalog()

    // Act.
    const notes = await catalog.notes.listMyNotes()
    const notifications = await catalog.notifications.list()

    // Assert: each list is in descending time order.
    const descending = (times: string[]) =>
      times.every((time, i) => i === 0 || Date.parse(times[i - 1] ?? '') >= Date.parse(time))
    expect(descending(notes.map((n) => n.updatedAt))).toBe(true)
    expect(descending(notifications.map((n) => n.createdAt))).toBe(true)
  })

  // Proves callers get copies, so a page changing an object can't corrupt the demo data.
  it('returns copies, not the stored objects', async () => {
    // Arrange.
    const catalog = createCatalog()
    const [first] = await catalog.courses.listMyCourses()
    if (first) first.title = 'changed by a caller'

    // Assert: the next read is unaffected.
    const [again] = await catalog.courses.listMyCourses()
    expect(again?.title).not.toBe('changed by a caller')
  })

  // Proves the published-summary filter narrows to one course.
  it('filters published summaries by course', async () => {
    // Act.
    const summaries = await createCatalog().summaries.listPublished({ courseId: 'swe-311' })

    // Assert.
    expect(summaries.length).toBeGreaterThan(0)
    expect(summaries.every((s) => s.courseId === 'swe-311')).toBe(true)
  })

  // Proves viewed summaries and read notifications survive a reload when a store is given.
  it('remembers viewed summaries and read notifications across a reload', async () => {
    // Arrange: a catalog saving to localStorage.
    const withStore = () =>
      createMockCatalog({ seed: createSeed(new Date()), latencyMs: 0, store: window.localStorage })
    const first = withStore()
    await first.summaries.markViewed('summary-swe-311-c2')
    await first.notifications.markAllRead()

    // Act: "reload".
    const again = withStore()

    // Assert.
    expect((await again.summaries.getByClass('swe-311-c2')).viewedByMe).toBe(true)
    await expect(again.notifications.unreadCount()).resolves.toBe(0)
  })

  // SECURITY: proves a student in no courses sees nothing of the demo's courses, classes, notes,
  // summaries or notifications, and a course they aren't in is not found (D76).
  it('shows nothing to a student who is in no courses', async () => {
    const catalog = createMockCatalog({
      seed: createSeed(new Date()),
      latencyMs: 0,
      enrolledCourseIds: () => new Set<string>(),
    })

    await expect(catalog.courses.listMyCourses()).resolves.toEqual([])
    await expect(catalog.classes.listMyClasses()).resolves.toEqual([])
    await expect(catalog.notes.listMyNotes()).resolves.toEqual([])
    await expect(catalog.summaries.listPublished()).resolves.toEqual([])
    await expect(catalog.notifications.list()).resolves.toEqual([])
    await expect(catalog.courses.getCourse('swe-311')).rejects.toMatchObject({ kind: 'not_found' })
    await expect(catalog.classes.listClasses('swe-311')).rejects.toMatchObject({
      kind: 'not_found',
    })
    await expect(
      catalog.notes.createNote({
        classId: 'swe-311-c1',
        title: 'x',
        contentHtml: '<p>x</p>',
        tags: [],
      }),
    ).rejects.toMatchObject({ kind: 'not_found' })
  })

  // Proves only the courses the student is in contribute, and the answer follows a change at once.
  it('follows the courses the student is in, call by call', async () => {
    let enrolled = new Set(['swe-311'])
    const catalog = createMockCatalog({
      seed: createSeed(new Date()),
      latencyMs: 0,
      enrolledCourseIds: () => enrolled,
    })

    expect((await catalog.courses.listMyCourses()).map((course) => course.id)).toEqual(['swe-311'])
    expect((await catalog.classes.listMyClasses()).every((c) => c.courseId === 'swe-311')).toBe(
      true,
    )
    enrolled = new Set(['swe-311', 'eng-201'])
    expect((await catalog.courses.listMyCourses()).map((course) => course.id)).toEqual([
      'swe-311',
      'eng-201',
    ])
  })
})
