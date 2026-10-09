/**
 * Saves the demo platform's changeable records (the summaries a teacher edits and publishes) in
 * local storage, so changes survive a reload as server data would. Sign-out leaves them, like a
 * real server.
 */

// Shape checks for what is read back.
import { z } from 'zod'

// The records.
import type { PlatformData } from '../platformData'

// The demo data's storage prefix.
import { DEMO_DATA_PREFIX } from './mockAuthService'

/** Where the saved records live. */
export const PLATFORM_KEY = `${DEMO_DATA_PREFIX}platform`

/** What a saved draft must look like. Lenient on empty text: a summary not yet drafted is empty. */
const draftSchema = z.object({
  overview: z.string(),
  keyConcepts: z.array(z.object({ id: z.string(), title: z.string(), explanation: z.string() })),
  confusionAreas: z.array(
    z.object({ id: z.string(), issue: z.string(), clarification: z.string() }),
  ),
  keyTopics: z.array(z.object({ id: z.string(), name: z.string(), description: z.string() })),
})

/** What a saved summary must look like: only the parts a teacher changes. */
const summarySchema = z.object({
  id: z.string(),
  status: z.enum(['collecting', 'processing', 'in_review', 'published']),
  inReviewSince: z.string().nullable(),
  publishedAt: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  draft: draftSchema,
  version: z.number().int().min(1),
})

/** What the saved records must look like. */
const storedSchema = z.object({ summaries: z.array(summarySchema) })

/** `seed`, with any saved changes to its summaries in place of the seed's own. */
export function loadPlatform(store: Storage, seed: PlatformData): PlatformData {
  // Nothing saved: the seed as it is.
  const raw = store.getItem(PLATFORM_KEY)
  if (raw === null) return seed
  // SECURITY: storage can be edited by hand, so its contents are checked before use. A bad save
  // is ignored rather than trusted, so it can't publish or show anything the seed doesn't have.
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return seed
    // The saved summaries by ID; one for a summary the seed doesn't have is ignored.
    const saved = new Map(parsed.data.summaries.map((summary) => [summary.id, summary]))
    return {
      ...seed,
      summaries: seed.summaries.map((summary) => ({ ...summary, ...saved.get(summary.id) })),
    }
  } catch {
    // Not JSON.
    return seed
  }
}

/** Saves `data`'s summaries' changeable parts. */
export function savePlatform(store: Storage, data: PlatformData) {
  // Only what a teacher changes; everything else comes from the seed each time.
  const summaries = data.summaries.map(
    ({ id, status, inReviewSince, publishedAt, reviewedBy, draft, version }) => ({
      id,
      status,
      inReviewSince,
      publishedAt,
      reviewedBy,
      draft,
      version,
    }),
  )
  store.setItem(PLATFORM_KEY, JSON.stringify({ summaries }))
}
