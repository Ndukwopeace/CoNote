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
})
