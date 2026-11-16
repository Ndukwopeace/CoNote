/**
 * What the admin Feedback page shows (D125): a piece of feedback with who sent it, and the page of
 * them a filter asks for. Feedback is words only, shown as plain text.
 */

// The kinds and the shared service.
import type { FeedbackKind, FeedbackService } from '@conote/core/feedback'
// The roles.
import type { Role } from '@conote/domain'

/** Whether an administrator has looked at a piece of feedback. */
export type FeedbackStatus = 'new' | 'read'

/** How many pieces of feedback a page holds. */
export const FEEDBACK_PAGE_SIZE = 20

/** One piece of feedback. */
export interface FeedbackItem {
  id: string
  kind: FeedbackKind
  message: string
  // 1 to 5, or null when the sender gave none.
  rating: number | null
  // The page the sender was on, or null when not recorded.
  page: string | null
  status: FeedbackStatus
  // ISO 8601 time.
  createdAt: string
  // Who sent it; null once their account is deleted.
  senderName: string | null
  senderEmail: string | null
  senderRole: Role
}

/** What the list is narrowed by. */
export interface FeedbackFilter {
  status?: FeedbackStatus | undefined
  kind?: FeedbackKind | undefined
  // Where the page starts, counted in pieces of feedback.
  offset?: number | undefined
}

/** One page of feedback, newest first, and how many match in all. */
export interface FeedbackPage {
  items: FeedbackItem[]
  total: number
}

/** The console's feedback service: sending (like every app) and reading and sorting. */
export interface AdminFeedbackService extends FeedbackService {
  /** One page of feedback, newest first. */
  listFeedback(filter: FeedbackFilter): Promise<FeedbackPage>
  /** Marks a piece of feedback new or read; rejects with not_found for an unknown ID. */
  setFeedbackStatus(feedbackId: string, status: FeedbackStatus): Promise<void>
}
