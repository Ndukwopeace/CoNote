/**
 * The demo Ask CoNote AI (FR-AI-6): prepared replies after a short, varied delay.
 */

// The prepared replies.
import { cannedReply } from '@/lib/aiReplies'
// The error type.
import { AppError } from '@conote/core/errors'

// The interface implemented.
import type { AiService } from '../types'

/** The reply delay range, in milliseconds (FR-AI-6). */
export const AI_DELAY_MS = { min: 600, max: 1200 }

/** What the factory accepts; tests replace the randomness or the whole delay. */
interface MockAiOptions {
  // A number in [0, 1); Math.random by default.
  random?: () => number
  // The delay in ms; derived from `random` by default. Tests pass () => 0.
  delay?: () => number
}

/** Builds the demo AI service. */
export function createMockAiService({
  random = Math.random,
  delay,
}: MockAiOptions = {}): AiService {
  /** 600–1200 ms, spread evenly. */
  const pickDelay =
    delay ??
    (() => AI_DELAY_MS.min + Math.floor(random() * (AI_DELAY_MS.max - AI_DELAY_MS.min + 1)))

  return {
    askAi: async (_context, messages) => {
      // The question is the last message, and it must be the student's.
      const last = messages.at(-1)
      if (last?.role !== 'user') throw new AppError('validation', 'Ask a question first.')
      // Behave like a model taking a moment.
      const ms = pickDelay()
      if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms))
      // The prepared reply.
      return cannedReply(last.content)
    },
  }
}
