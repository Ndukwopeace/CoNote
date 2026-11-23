/**
 * The public form page's service on Supabase (D126): read a form by its link and send an answer.
 * Both go through database functions that anyone may call, so they work without signing in. The
 * database checks every rule again; this module sends the questions and checks the answers.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The shapes shared with the demo service, and the rule that checks an answer first.
import { AppError } from '@conote/core/errors'
import { FORM_QUESTION_KINDS, type PublicForm, type PublicFormService } from '@conote/core/forms'

// Turns database failures into AppErrors.
import { fromSupabaseError } from './errors'
// Reads and checks a result.
import { readOne } from './rows'

// SECURITY: the form is checked on arrival, so a field the page does not know is refused, not shown.
const formSchema = z.object({
  title: z.string(),
  description: z.string(),
  state: z.enum(['open', 'not_open', 'closed']),
  questions: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(FORM_QUESTION_KINDS),
      prompt: z.string(),
      required: z.boolean(),
      options: z.array(z.string()),
    }),
  ),
  lecturers: z.array(
    z.object({
      courseId: z.string(),
      courseCode: z.string(),
      courseTitle: z.string(),
      lecturer: z.string(),
    }),
  ),
})

/** What the service needs. */
interface SupabasePublicFormOptions {
  // The one client the app uses. It works signed out.
  client: SupabaseClient
}

/** Builds the Supabase PublicFormService. */
export function createSupabasePublicFormService({
  client,
}: Readonly<SupabasePublicFormOptions>): PublicFormService {
  return {
    async getForm(token): Promise<PublicForm> {
      // The function answers "not found" for an unknown link.
      const form = await readOne(client.rpc('public_form', { p_token: token }), formSchema)
      if (form === null) throw new AppError('not_found', 'We could not find that form.')
      return form
    },

    async submit(token, answers) {
      const { error } = await client.rpc('submit_form_response', {
        p_token: token,
        p_answers: answers,
      })
      // A refusal (closed form, a bad answer, too many answers) becomes an AppError.
      if (error) throw fromSupabaseError(error)
    },
  }
}
