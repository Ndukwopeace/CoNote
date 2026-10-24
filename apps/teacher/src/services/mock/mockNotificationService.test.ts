/**
 * Tests for the demo NotificationService: a notice for each draft waiting in the review queue,
 * with what was read kept in storage like server data.
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// A platform with one summary in the stage the test asks for, and the teacher who owns it.
import { ME, reviewPlatform } from '@/test/reviewPlatform'

// The unit under test, and the review service it listens to.
import { createMockNotificationService, READ_NOTICES_KEY } from './mockNotificationService'
import { createMockReviewService } from './mockReviewService'

/** Builds the service over a platform, with a fresh pretend storage. */
function setup(status: Parameters<typeof reviewPlatform>[0] = 'in_review') {
  const platform = reviewPlatform(status)
  const review = createMockReviewService({
    data: platform,
    actorId: () => ME,
    now: () => new Date('2026-10-08T00:00:00.000Z'),
    latencyMs: 0,
  })
  const store = window.localStorage
  return { service: createMockNotificationService({ review, store, latencyMs: 0 }), store }
}

describe('mock Notification service', () => {
  // Each test starts with nothing read.
  beforeEach(() => {
    window.localStorage.clear()
  })

  // Proves a draft waiting for review becomes one unread notice that opens it.
  it('gives one unread notice for a draft in review', async () => {
    const { service } = setup()

    await expect(service.list()).resolves.toEqual([
      {
        id: 'draft-s1',
        type: 'summary',
        title: 'A draft is ready to review',
        body: 'MTH 202, class 4: Basis and dimension',
        link: '/teacher/reviews/s1',
        createdAt: '2026-10-07T12:00:00.000Z',
        read: false,
      },
    ])
  })

  // Proves a summary that is no longer waiting leaves no notice.
  it('gives no notice once the summary is published', async () => {
    const { service } = setup('published')

    await expect(service.list()).resolves.toEqual([])
  })

  // Proves marking one read is remembered, and a new service sees it.
  it('remembers a notice marked as read', async () => {
    const { service, store } = setup()

    await service.markRead('draft-s1')

    expect((await service.list())[0]).toMatchObject({ read: true })
    expect(JSON.parse(store.getItem(READ_NOTICES_KEY) ?? '[]')).toEqual(['draft-s1'])
    // A second service over the same storage, as after a reload.
    const again = setup().service
    expect((await again.list())[0]).toMatchObject({ read: true })
  })

  // Proves "mark all" reads every notice.
  it('marks every notice as read', async () => {
    const { service } = setup()

    await service.markAllRead()

    expect((await service.list()).every((notice) => notice.read)).toBe(true)
  })

  // Proves an unknown notice is not_found, like the real service.
  it('reports an unknown notice as not_found', async () => {
    const { service } = setup()

    await expect(service.markRead('draft-nope')).rejects.toMatchObject({ kind: 'not_found' })
  })

  // Proves unreadable stored data is ignored, not trusted.
  it('ignores stored read-state that is not a list of text', async () => {
    window.localStorage.setItem(READ_NOTICES_KEY, '{"oops":1}')
    const { service } = setup()

    expect((await service.list())[0]).toMatchObject({ read: false })
  })
})
