/**
 * Feedback from the people who use the app (D125): what a piece of feedback is, how it is checked
 * before it is sent, and the service every app's feedback button talks to. The database checks the
 * same limits again; this copy lets the form say what is wrong without a round trip.
 */

// The error type every service throws.
import { AppError } from './errors'

/** The kinds of feedback, in the order the form lists them. */
export const FEEDBACK_KINDS = ['bug', 'idea', 'other'] as const

/** One kind of feedback. */
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

/** How each kind reads in the form and in the admin list. */
export const FEEDBACK_KIND_LABELS: Readonly<Record<FeedbackKind, string>> = {
  bug: 'Something is broken',
  idea: 'An idea',
  other: 'Something else',
}

/** The longest message, in characters. The database refuses more. */
export const FEEDBACK_MAX_LENGTH = 2000

/** What the form sends. */
export interface FeedbackInput {
  kind: FeedbackKind
  message: string
  // 1 (poor) to 5 (great), or null when the sender gave none.
  rating: number | null
  // The page the sender was on, as an address path without a query or a hash.
  page: string
}

/** What every app's feedback button sends through. */
export interface FeedbackService {
  /** Sends one piece of feedback. Rejects with a validation error for an unusable one. */
  send(input: FeedbackInput): Promise<void>
}

/** What is wrong with `input`, in words for the sender, or null when it can be sent. */
export function feedbackProblem(input: Readonly<Pick<FeedbackInput, 'message'>>): string | null {
  // Only spaces is as good as nothing.
  const length = input.message.trim().length
  if (length === 0) return 'Write a message before you send.'
  // The database refuses more than the limit, so say so here first.
  if (length > FEEDBACK_MAX_LENGTH) {
    return `Keep it under ${String(FEEDBACK_MAX_LENGTH)} characters.`
  }
  return null
}

/** The path of an address, without a query or a hash, cut to the length the database keeps. */
export function pageOf(pathname: string): string {
  return pathname.split(/[?#]/, 1)[0]?.slice(0, 200) ?? ''
}

/**
 * The demo's feedback sender: checks the message like the real one, waits like a network call, and
 * keeps nothing. The admin demo keeps its own list, so a demo send from another app never reaches it.
 */
export function createDemoFeedbackService(latencyMs: number): FeedbackService {
  return {
    async send(input) {
      // Behave like a network call, so the form's sending state shows.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, latencyMs)
      })
      // An unusable message is refused as the database would refuse it.
      const problem = feedbackProblem(input)
      if (problem !== null) throw new AppError('validation', problem)
    },
  }
}
