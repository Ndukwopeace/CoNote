/**
 * The demo NotificationService (D111): one notice for each draft waiting in the review queue,
 * worded as the server words it. Which notices were read is kept in storage and survives sign-out,
 * like server data. A draft that is published or no longer waiting has no notice.
 */

// Shape checks for what is read back from storage.
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'

// Where the draft opens.
import { routeTo } from '@/lib/routes'

// The demo data's storage prefix.
import { DEMO_DATA_PREFIX } from './mockAuthService'
// The fake network delay.
import { simulateLatency } from './latency'
// The shapes this implements, and the service it listens to.
import type { NotificationService, ReviewService, TeacherNotification } from '../types'

/** Where the IDs of read notices are saved. */
export const READ_NOTICES_KEY = `${DEMO_DATA_PREFIX}read-notices`

/** What the saved read-state must look like: a list of notice IDs. */
const readIdsSchema = z.array(z.string())

/** What the demo service needs. */
interface MockNotificationOptions {
  // Whose drafts are waiting.
  review: Pick<ReviewService, 'listReviewQueue'>
  // Where read-state is kept.
  store: Storage
  // How long each call pretends to take.
  latencyMs: number
}

/** Builds the demo notification service. */
export function createMockNotificationService({
  review,
  store,
  latencyMs,
}: MockNotificationOptions): NotificationService {
  /** The IDs read so far. Anything unreadable counts as nothing read. */
  function readIds(): Set<string> {
    try {
      const parsed = readIdsSchema.safeParse(JSON.parse(store.getItem(READ_NOTICES_KEY) ?? '[]'))
      return new Set(parsed.success ? parsed.data : [])
    } catch {
      return new Set()
    }
  }

  /** Saves the IDs read. */
  function saveIds(ids: Set<string>) {
    store.setItem(READ_NOTICES_KEY, JSON.stringify([...ids]))
  }

  /** Every notice, newest first, with its read flag. */
  async function notices(): Promise<TeacherNotification[]> {
    const read = readIds()
    const queue = await review.listReviewQueue()
    return queue
      .map((item): TeacherNotification => ({
        id: `draft-${item.summaryId}`,
        type: 'summary',
        title: 'A draft is ready to review',
        body: `${item.courseCode}, class ${String(item.classNumber)}: ${item.classTitle}`,
        link: routeTo.review(item.summaryId),
        createdAt: item.inReviewSince,
        read: read.has(`draft-${item.summaryId}`),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  return {
    async list() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      return notices()
    },

    async markRead(notificationId) {
      await simulateLatency(latencyMs)
      // Only a notice that exists can be marked.
      if (!(await notices()).some((notice) => notice.id === notificationId)) {
        throw new AppError('not_found', 'Notification not found')
      }
      const ids = readIds()
      ids.add(notificationId)
      saveIds(ids)
    },

    async markAllRead() {
      await simulateLatency(latencyMs)
      const ids = readIds()
      for (const notice of await notices()) ids.add(notice.id)
      saveIds(ids)
    },
  }
}
