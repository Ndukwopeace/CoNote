/**
 * The admin AdminFormService on Supabase (D126). Forms and their answers sit in tables closed to every
 * browser; an administrator builds and reads them through functions that check who is asking. Rows are
 * checked on arrival, so one of the wrong shape is refused rather than shown.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
import { FORM_QUESTION_KINDS } from '@conote/core/forms'
// Turns database failures into AppErrors.
import { fromSupabaseError } from '@conote/supabase/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'
// Reads and checks rows.
import { readOne, readRows } from '@conote/supabase/rows'

// The shapes it returns.
import { FORM_RESPONSES_PAGE_SIZE, type AdminFormService, type FormDraft } from '@/types/forms'

/** Says "not found" for something that is not a UUID, without asking the database. */
function requireUuid(value: string, what: string): void {
  // SECURITY: an ID that is not a UUID never reaches a query.
  if (!isUuid(value)) throw new AppError('not_found', `We could not find that ${what}.`)
}

// SECURITY: each shape is checked on arrival, so a field the app does not know is refused, not shown.
const stateSchema = z.enum(['open', 'not_open', 'closed'])
const questionSchema = z.object({
  id: z.string(),
  kind: z.enum(FORM_QUESTION_KINDS),
  prompt: z.string(),
  required: z.boolean(),
  options: z.array(z.string()),
})
const listRow = z.object({
  id: z.string(),
  token: z.string(),
  title: z.string(),
  accepting: z.boolean(),
  opens_at: z.string().nullable(),
  closes_at: z.string().nullable(),
  created_at: z.string(),
  state: stateSchema,
  question_count: z.number(),
  response_count: z.number(),
})
const formSchema = z.object({
  id: z.string(),
  token: z.string(),
  title: z.string(),
  description: z.string(),
  accepting: z.boolean(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  state: stateSchema,
  responseCount: z.number(),
  questions: z.array(questionSchema),
  lecturers: z.array(
    z.object({
      courseId: z.string(),
      courseCode: z.string(),
      courseTitle: z.string(),
      lecturer: z.string(),
    }),
  ),
})
const summaryRow = z.object({
  course_code: z.string().nullable(),
  lecturer: z.string().nullable(),
  responses: z.number(),
  averages: z.record(z.string(), z.number()),
})
const responseRow = z.object({
  id: z.string(),
  created_at: z.string(),
  course_code: z.string().nullable(),
  lecturer: z.string().nullable(),
  answers: z.record(z.string(), z.union([z.string(), z.number()])),
  total_count: z.number(),
})

/** What the function takes for a draft: the same fields, with the choices only where they belong. */
function payloadOf(draft: FormDraft) {
  return {
    id: draft.id ?? null,
    title: draft.title,
    description: draft.description,
    accepting: draft.accepting,
    opensAt: draft.opensAt,
    closesAt: draft.closesAt,
    questions: draft.questions.map((question) => ({
      id: question.id ?? null,
      kind: question.kind,
      prompt: question.prompt,
      required: question.required,
      options: question.options,
    })),
  }
}

/** Builds the Supabase AdminFormService. */
export function createSupabaseAdminFormService({
  client,
}: Readonly<{ client: SupabaseClient }>): AdminFormService {
  return {
    async listForms() {
      const rows = await readRows(client.rpc('admin_list_forms'), listRow)
      return rows.map((row) => ({
        id: row.id,
        token: row.token,
        title: row.title,
        accepting: row.accepting,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
        createdAt: row.created_at,
        state: row.state,
        questionCount: row.question_count,
        responseCount: row.response_count,
      }))
    },

    async getForm(formId) {
      requireUuid(formId, 'form')
      const form = await readOne(client.rpc('admin_get_form', { p_id: formId }), formSchema)
      if (form === null) throw new AppError('not_found', 'We could not find that form.')
      return form
    },

    async saveForm(draft) {
      if (draft.id !== undefined) requireUuid(draft.id, 'form')
      const id = await readOne(
        client.rpc('admin_save_form', { p_form: payloadOf(draft) }),
        z.string(),
      )
      if (id === null) throw fromSupabaseError({ message: 'Malformed row', cause: 'no form ID' })
      return id
    },

    async deleteForm(formId) {
      requireUuid(formId, 'form')
      const { error } = await client.rpc('admin_delete_form', { p_id: formId })
      if (error) throw fromSupabaseError(error)
    },

    async getSummary(formId) {
      requireUuid(formId, 'form')
      const rows = await readRows(client.rpc('admin_form_summary', { p_id: formId }), summaryRow)
      return rows.map((row) => ({
        courseCode: row.course_code,
        lecturer: row.lecturer,
        responses: row.responses,
        averages: row.averages,
      }))
    },

    async listResponses(formId, filter) {
      requireUuid(formId, 'form')
      const rows = await readRows(
        client.rpc('admin_form_responses', {
          p_id: formId,
          p_course: filter.courseCode ?? null,
          p_lecturer: filter.lecturer ?? null,
          p_limit: FORM_RESPONSES_PAGE_SIZE,
          p_offset: Math.max(filter.offset ?? 0, 0),
        }),
        responseRow,
      )
      const offset = Math.max(filter.offset ?? 0, 0)
      let total = rows[0]?.total_count ?? 0
      // The total rides on the rows, so a page past the end has none to read it from. Ask for the
      // first page then, so the answer matches the demo's: the real total, and no items.
      if (rows.length === 0 && offset > 0) {
        const first = await readRows(
          client.rpc('admin_form_responses', {
            p_id: formId,
            p_course: filter.courseCode ?? null,
            p_lecturer: filter.lecturer ?? null,
            p_limit: 1,
            p_offset: 0,
          }),
          responseRow,
        )
        total = first[0]?.total_count ?? 0
      }
      return {
        items: rows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          courseCode: row.course_code,
          lecturer: row.lecturer,
          answers: row.answers,
        })),
        total,
      }
    },

    async deleteResponse(responseId) {
      requireUuid(responseId, 'response')
      const { error } = await client.rpc('admin_delete_form_response', { p_id: responseId })
      if (error) throw fromSupabaseError(error)
    },
  }
}
