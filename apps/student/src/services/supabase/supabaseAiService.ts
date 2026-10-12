/**
 * Ask CoNote AI on Supabase (FR-AI). The question goes to the `ask-ai` Edge Function, which checks
 * the student, reads only their own notes and the approved summaries of their own courses, counts
 * the question against a daily limit and asks the language model. This service only shapes the
 * request and turns the answer back into a reply or the error a screen already handles.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Calls an Edge Function and turns a refusal back into an error.
import { invokeThrough, unwrap, type InvokeFunction } from '@conote/supabase/functionCall'
// Refuses IDs that are not UUIDs before they are sent anywhere.
import { isUuid } from '@conote/supabase/ids'

// The context and message shapes.
import type { AiContext, AiMessage } from '@/types/domain'

// The interface this implementation must satisfy.
import type { AiService } from '../types'

/** The function's limits: the most messages, and the longest one, it accepts. */
const MAX_MESSAGES = 20
const MAX_CONTENT = 2000

// SECURITY: the answer is checked, not trusted. Anything but a non-empty text is a failure, never
// something shown on a screen.
const replySchema = z.object({ reply: z.string().min(1) })

/** What the service needs. */
interface SupabaseAiOptions {
  // The one client the app uses.
  client: SupabaseClient
  // How a function is called. Tests pass their own; the app goes through the client.
  invoke?: InvokeFunction
}

/** The part of the request that names what the question is about. */
function scopeOf(context: AiContext): Record<string, string> {
  // SECURITY: an ID from the address or a form is untrusted, so one that is not a UUID is refused
  // here; it answers like any course or class that is not the student's.
  if (context.scope === 'course') {
    if (!context.courseId || !isUuid(context.courseId)) {
      throw new AppError('not_found', "We couldn't find that course.")
    }
    return { scope: 'course', courseId: context.courseId }
  }
  if (context.scope === 'class') {
    if (!context.classId || !isUuid(context.classId)) {
      throw new AppError('not_found', "We couldn't find that class.")
    }
    return { scope: 'class', classId: context.classId }
  }
  return { scope: 'all' }
}

/** Builds the Supabase AiService. */
export function createSupabaseAiService({
  client,
  invoke = invokeThrough(client),
}: SupabaseAiOptions): AiService {
  return {
    // A real model answers, so nothing here is an example.
    isPreview: false,

    async askAi(context: AiContext, messages: AiMessage[]) {
      // The question is the last message, and it must be the student's.
      if (messages.at(-1)?.role !== 'user') {
        throw new AppError('validation', 'Ask a question first.')
      }
      const scope = scopeOf(context)
      // Only what the function needs: the role and the text. The latest messages only, each cut
      // to the function's limit, so a long conversation is never refused for its length.
      const sent = messages.slice(-MAX_MESSAGES).map(({ role, content }) => ({
        role,
        content: content.slice(0, MAX_CONTENT),
      }))
      // The function checks the student, the scope, the daily limit and asks the model.
      const answer = replySchema.safeParse(
        unwrap(await invoke('ask-ai', { ...scope, messages: sent })),
      )
      if (!answer.success) throw new AppError('unknown', 'Ask AI sent an answer we could not read.')
      return answer.data.reply
    },
  }
}
