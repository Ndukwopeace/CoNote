/**
 * The rules for a summary draft (teacher REQUIREMENTS section 9). The review form and the service
 * share them, so the browser and the "server" can never disagree.
 */

// Schema builder.
import { z } from 'zod'

// The draft's shape.
import type { SummaryDraft } from '@/types/review'

/** The most characters a field may hold, by kind. */
export const DRAFT_LIMITS = { overview: 4000, heading: 200, body: 2000, items: 30 } as const

/** A required text field: trimmed first, so spaces alone count as blank. */
function required(message: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, message)
    .max(max, `Keep this under ${String(max)} characters.`)
}

/** What a draft must look like to be saved or published. Lists may be empty. */
export const draftSchema = z.object({
  overview: required('Enter the overview.', DRAFT_LIMITS.overview),
  keyConcepts: z
    .array(
      z.object({
        id: z.string().min(1),
        title: required('Enter the concept title.', DRAFT_LIMITS.heading),
        explanation: required('Enter the concept explanation.', DRAFT_LIMITS.body),
      }),
    )
    .max(DRAFT_LIMITS.items),
  confusionAreas: z
    .array(
      z.object({
        id: z.string().min(1),
        issue: required('Enter the point of confusion.', DRAFT_LIMITS.heading),
        clarification: required('Enter the clarification.', DRAFT_LIMITS.body),
      }),
    )
    .max(DRAFT_LIMITS.items),
  keyTopics: z
    .array(
      z.object({
        id: z.string().min(1),
        name: required('Enter the topic name.', DRAFT_LIMITS.heading),
        // The one optional field: blank is allowed, and trimmed.
        description: z.string().trim().max(DRAFT_LIMITS.body, 'Keep this under 2000 characters.'),
      }),
    )
    .max(DRAFT_LIMITS.items),
}) satisfies z.ZodType<SummaryDraft, SummaryDraft>

/** An empty draft: what a summary has before the AI writes it. */
export function emptyDraft(): SummaryDraft {
  return { overview: '', keyConcepts: [], confusionAreas: [], keyTopics: [] }
}
