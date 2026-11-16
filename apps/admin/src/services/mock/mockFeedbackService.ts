/**
 * The demo AdminFeedbackService (D125): feedback sent from the console is added to the demo
 * platform, and the list reads it with the sender's name and email from the demo accounts.
 */

// The rules, and the error type.
import { feedbackProblem } from '@conote/core/feedback'
import { AppError } from '@conote/core/errors'

// The records it reads and writes.
import type { PlatformData } from '../platformData'
// The shapes it returns.
import { FEEDBACK_PAGE_SIZE, type AdminFeedbackService, type FeedbackItem } from '@/types/feedback'

// Fake network delay.
import { simulateLatency } from './latency'

/** What the demo service needs. */
interface MockFeedbackOptions {
  data: PlatformData
  now: () => Date
  // The signed-in administrator's ID, or null when nobody is signed in.
  actorId: () => string | null
  latencyMs: number
  // Called after a change, so the demo can save the platform.
  onChange?: () => void
}

/** Builds the demo AdminFeedbackService over `data`. */
export function createMockFeedbackService({
  data,
  now,
  actorId,
  latencyMs,
  onChange,
}: MockFeedbackOptions): AdminFeedbackService {
  /** A stored record, with its sender's details read from the accounts. */
  function itemOf(record: PlatformData['feedback'][number]): FeedbackItem {
    const sender = data.users.find((user) => user.id === record.userId)
    return {
      id: record.id,
      kind: record.kind,
      message: record.message,
      rating: record.rating,
      page: record.page,
      status: record.status,
      createdAt: record.createdAt,
      senderName: sender?.fullName ?? null,
      senderEmail: sender?.email ?? null,
      senderRole: record.role,
    }
  }

  return {
    async send(input) {
      await simulateLatency(latencyMs)
      // An unusable message is refused as the database would refuse it.
      const problem = feedbackProblem(input)
      if (problem !== null) throw new AppError('validation', problem)
      // SECURITY: no session, no feedback: the sender is the signed-in administrator, never an argument.
      const id = actorId()
      if (id === null) throw new AppError('unauthorized', 'Sign in to send feedback.')
      data.feedback.push({
        id: `fb-${String(data.feedback.length + 1)}-${String(now().getTime())}`,
        userId: id,
        role: 'admin',
        kind: input.kind,
        message: input.message.trim(),
        rating: input.rating,
        page: input.page === '' ? null : input.page,
        status: 'new',
        createdAt: now().toISOString(),
      })
      onChange?.()
    },

    async listFeedback(filter) {
      await simulateLatency(latencyMs)
      // Newest first, narrowed by status and kind.
      const matches = data.feedback
        .filter(
          (record) =>
            (filter.status === undefined || record.status === filter.status) &&
            (filter.kind === undefined || record.kind === filter.kind),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      // One page of them.
      const offset = Math.max(filter.offset ?? 0, 0)
      return {
        items: matches.slice(offset, offset + FEEDBACK_PAGE_SIZE).map(itemOf),
        total: matches.length,
      }
    },

    async setFeedbackStatus(feedbackId, status) {
      await simulateLatency(latencyMs)
      const record = data.feedback.find((item) => item.id === feedbackId)
      if (!record) throw new AppError('not_found', 'We could not find that feedback.')
      record.status = status
      onChange?.()
    },
  }
}
