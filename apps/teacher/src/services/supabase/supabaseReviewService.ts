/**
 * The teacher ReviewService on Supabase (milestone B3.2, D89): the summaries waiting for review,
 * opening one, saving a draft and publishing it. Reading goes through a view that shows a teacher
 * only the summaries of their own live courses. Saving and publishing go through database
 * functions, which check the caller, the stage, the version and the draft's shape; the browser
 * cannot edit a draft any other way.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// The codes of refused database calls.
import { databaseCode } from '@conote/supabase/databaseErrors'
// Turns database failures into AppErrors.
import { fromSupabaseError } from '@conote/supabase/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'
// Reads and checks rows.
import { readOne, readRows } from '@conote/supabase/rows'

// The draft's rules, shared with the review form.
import { draftSchema } from '@/lib/draftSchema'
// The shapes returned.
import type { ReviewDetails, ReviewQueueItem, SummaryDraft } from '@/types/review'

// The interface this implementation must satisfy.
import type { ReviewService } from '../types'

/** What every "no such summary" answers, whatever the reason, so the answer reveals nothing. */
const SUMMARY_NOT_FOUND = "We couldn't find that summary."

/** The message for a draft that changed, or is no longer in review. */
const STALE_DRAFT = 'This draft changed. Reload to see the latest.'

// SECURITY: each shape is checked on arrival, so a stage the app does not know, or draft text of
// the wrong shape, is refused instead of reaching a screen.
const keyConcept = z.object({ id: z.string(), title: z.string(), explanation: z.string() })
const confusionArea = z.object({ id: z.string(), issue: z.string(), clarification: z.string() })
const keyTopic = z.object({ id: z.string(), name: z.string(), description: z.string() })
const reviewRow = z.object({
  summary_id: z.string(),
  course_id: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  class_number: z.number(),
  class_title: z.string(),
  status: z.enum(['collecting', 'processing', 'in_review', 'published']),
  version: z.number(),
  overview: z.string(),
  key_concepts: z.array(keyConcept),
  confusion_areas: z.array(confusionArea),
  key_topics: z.array(keyTopic),
  notes_analyzed_count: z.number(),
  students_analyzed_count: z.number(),
  in_review_since: z.string().nullable(),
  published_at: z.string().nullable(),
  reviewed_by_name: z.string().nullable(),
})

type ReviewRow = z.infer<typeof reviewRow>

// The columns of the view the service reads.
const REVIEW_COLUMNS =
  'summary_id, course_id, course_code, course_title, class_number, class_title, status, version, overview, key_concepts, confusion_areas, key_topics, notes_analyzed_count, students_analyzed_count, in_review_since, published_at, reviewed_by_name'

/** What the service needs. */
interface SupabaseReviewOptions {
  // The one client the portal uses.
  client: SupabaseClient
}

/** `value` as ISO text with a "Z", whatever form the database wrote it in. */
function iso(value: string): string {
  return new Date(value).toISOString()
}

/** The summary as the review screen shows it. */
function toDetails(row: ReviewRow): ReviewDetails {
  return {
    summaryId: row.summary_id,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    classNumber: row.class_number,
    classTitle: row.class_title,
    status: row.status,
    version: row.version,
    draft: {
      overview: row.overview,
      keyConcepts: row.key_concepts,
      confusionAreas: row.confusion_areas,
      keyTopics: row.key_topics,
    },
    notesAnalyzedCount: row.notes_analyzed_count,
    studentCount: row.students_analyzed_count,
    inReviewSince: row.in_review_since === null ? null : iso(row.in_review_since),
    publishedAt: row.published_at === null ? null : iso(row.published_at),
    reviewedBy: row.reviewed_by_name,
  }
}

/** Turns a refused save or publish into the error the screen expects. */
function writeError(error: unknown): AppError {
  switch (databaseCode(error)) {
    // Unknown, archived or another teacher's: all "not found", so nothing is revealed.
    case 'P0002':
      return new AppError('not_found', SUMMARY_NOT_FOUND)
    // A stale version, or a summary that is no longer in review.
    case '40001':
    case '23514':
      return new AppError('conflict', STALE_DRAFT)
    // The draft broke the form's rules (the form checks first, so this is a request that skipped it).
    case '22023':
      return new AppError('validation', 'Check the draft.')
    default:
      return fromSupabaseError(error)
  }
}

/** Builds the Supabase ReviewService. */
export function createSupabaseReviewService({ client }: SupabaseReviewOptions): ReviewService {
  /** SECURITY: nothing is asked of the database without a signed-in session. */
  async function requireSession(): Promise<void> {
    const { data } = await client.auth.getSession()
    if (!data.session) throw new AppError('unauthorized', 'Sign in to review summaries.')
  }

  /** One summary opened for review, or not_found. */
  async function find(summaryId: string): Promise<ReviewDetails> {
    // SECURITY: an ID that is not a UUID never reaches a query. It answers like any other summary
    // that is not the teacher's.
    if (!isUuid(summaryId)) throw new AppError('not_found', SUMMARY_NOT_FOUND)
    const row = await readOne(
      client
        .from('teacher_reviews')
        .select(REVIEW_COLUMNS)
        .eq('summary_id', summaryId)
        .maybeSingle(),
      reviewRow,
    )
    if (!row) throw new AppError('not_found', SUMMARY_NOT_FOUND)
    return toDetails(row)
  }

  /** Saves `draft` through the database function `name`, then reads the summary back. */
  async function write(
    name: 'save_summary_draft' | 'publish_summary_draft',
    summaryId: string,
    draft: SummaryDraft,
    version: number,
  ): Promise<ReviewDetails> {
    await requireSession()
    // SECURITY: the same rules as the form, enforced here too.
    const parsed = draftSchema.safeParse(draft)
    if (!parsed.success) {
      throw new AppError('validation', parsed.error.issues[0]?.message ?? 'Check the draft.')
    }
    if (!isUuid(summaryId)) throw new AppError('not_found', SUMMARY_NOT_FOUND)
    // The function checks the caller, the stage and the version, and saves (and publishes) at once.
    const { error } = await client.rpc(name, {
      p_summary: summaryId,
      p_version: version,
      p_overview: parsed.data.overview,
      p_key_concepts: parsed.data.keyConcepts,
      p_confusion_areas: parsed.data.confusionAreas,
      p_key_topics: parsed.data.keyTopics,
    })
    if (error) throw writeError(error)
    return find(summaryId)
  }

  return {
    async listReviewQueue() {
      await requireSession()
      // The view shows only this teacher's live summaries; those waiting, longest wait first.
      const rows = await readRows(
        client
          .from('teacher_reviews')
          .select(REVIEW_COLUMNS)
          .eq('status', 'in_review')
          .not('in_review_since', 'is', null)
          .order('in_review_since', { ascending: true }),
        reviewRow,
      )
      return rows.flatMap((row): ReviewQueueItem[] =>
        // The query keeps only rows that have a time; this narrows the type for the compiler.
        row.in_review_since === null
          ? []
          : [
              {
                summaryId: row.summary_id,
                courseId: row.course_id,
                courseCode: row.course_code,
                classNumber: row.class_number,
                classTitle: row.class_title,
                inReviewSince: iso(row.in_review_since),
                notesAnalyzedCount: row.notes_analyzed_count,
              },
            ],
      )
    },

    async getDraft(summaryId) {
      await requireSession()
      return find(summaryId)
    },

    saveDraft: (summaryId, draft, version) =>
      write('save_summary_draft', summaryId, draft, version),

    approveAndPublish: (summaryId, draft, version) =>
      write('publish_summary_draft', summaryId, draft, version),
  }
}
