/**
 * Sending feedback on Supabase, for every app (D125). The `feedback` table is closed to browsers;
 * `submit_feedback` takes the kind, message, rating and page, and the database fills in who sent
 * it and in which role from the session, so nothing here can be forged. Nothing is read back.
 */

// The client type.
import type { SupabaseClient } from '@supabase/supabase-js'

// The shapes shared with the demo services, and the rule that checks a message first.
import { feedbackProblem, type FeedbackService } from '@conote/core/feedback'
// The error type every service throws.
import { AppError } from '@conote/core/errors'

// Turns database failures into AppErrors.
import { fromSupabaseError } from './errors'

/** What the sender needs. */
interface SupabaseFeedbackOptions {
  // The one client the app uses.
  client: SupabaseClient
}

/** Builds the Supabase FeedbackService. */
export function createSupabaseFeedbackService({
  client,
}: SupabaseFeedbackOptions): FeedbackService {
  return {
    async send(input) {
      // An unusable message never leaves the browser.
      const problem = feedbackProblem(input)
      if (problem !== null) throw new AppError('validation', problem)
      // The database function checks the same limits again and records the sender.
      const { error } = await client.rpc('submit_feedback', {
        p_kind: input.kind,
        p_message: input.message,
        p_rating: input.rating,
        p_page: input.page,
      })
      // A refusal (too much feedback, a session that ended) becomes an AppError.
      if (error) throw fromSupabaseError(error)
    },
  }
}
