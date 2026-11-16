/**
 * The admin AdminFeedbackService on Supabase (D125): sending is the shared sender every app uses;
 * reading and sorting go through two administrator-only database functions, which check who is
 * asking. Rows are checked on arrival, so one of the wrong shape is refused rather than shown.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
import { FEEDBACK_KINDS } from '@conote/core/feedback'
// Turns database failures into AppErrors.
import { fromSupabaseError } from '@conote/supabase/errors'
// The shared sender.
import { createSupabaseFeedbackService } from '@conote/supabase/feedback'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'
// Reads and checks rows.
import { readRows } from '@conote/supabase/rows'

// The shapes it returns.
import { FEEDBACK_PAGE_SIZE, type AdminFeedbackService } from '@/types/feedback'

// SECURITY: each row is checked on arrival, so a field the app does not know is refused, not shown.
const feedbackRow = z.object({
  id: z.string(),
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string(),
  rating: z.number().nullable(),
  page: z.string().nullable(),
  status: z.enum(['new', 'read']),
  created_at: z.string(),
  sender_name: z.string().nullable(),
  sender_email: z.string().nullable(),
  sender_role: z.enum(['student', 'teacher', 'admin']),
  total_count: z.number(),
})

/** Builds the Supabase AdminFeedbackService. */
export function createSupabaseAdminFeedbackService({
  client,
}: Readonly<{ client: SupabaseClient }>): AdminFeedbackService {
  // Sending is the same in every app.
  const sender = createSupabaseFeedbackService({ client })
  return {
    send: (input) => sender.send(input),

    async listFeedback(filter) {
      const rows = await readRows(
        client.rpc('admin_list_feedback', {
          p_status: filter.status ?? null,
          p_kind: filter.kind ?? null,
          p_limit: FEEDBACK_PAGE_SIZE,
          p_offset: Math.max(filter.offset ?? 0, 0),
        }),
        feedbackRow,
      )
      return {
        items: rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          message: row.message,
          rating: row.rating,
          page: row.page,
          status: row.status,
          createdAt: row.created_at,
          senderName: row.sender_name,
          senderEmail: row.sender_email,
          senderRole: row.sender_role,
        })),
        // The total is the same on every row; no rows means no matches.
        total: rows[0]?.total_count ?? 0,
      }
    },

    async setFeedbackStatus(feedbackId, status) {
      // SECURITY: an ID that is not a UUID never reaches the database.
      if (!isUuid(feedbackId)) throw new AppError('not_found', 'We could not find that feedback.')
      const { error } = await client.rpc('admin_set_feedback_status', {
        p_id: feedbackId,
        p_status: status,
      })
      if (error) throw fromSupabaseError(error)
    },
  }
}
