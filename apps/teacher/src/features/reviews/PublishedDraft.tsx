/**
 * A published summary, read-only (teacher REQUIREMENTS section 9): students may already have read
 * it, so there is no edit or publish action.
 */

// Wording.
import { formatDate } from '@/lib/format'
// The shape shown.
import type { ReviewDetails } from '@/types/review'

/** The published text, with who published it and when. */
export function PublishedDraft({ details }: Readonly<{ details: ReviewDetails }>) {
  // The text.
  const { draft } = details
  return (
    <div className="space-y-8">
      {/* Who and when. */}
      <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success-strong">
        Published {formatDate(details.publishedAt)}
        {details.reviewedBy !== null && ` by ${details.reviewedBy}`}. It can no longer be edited.
      </p>
      {/* The overview. */}
      <section aria-labelledby="overview-heading" className="space-y-2">
        <h2 id="overview-heading" className="text-lg font-semibold">
          Overview
        </h2>
        <p className="whitespace-pre-line">{draft.overview}</p>
      </section>
      {/* Key concepts. */}
      <section aria-labelledby="concepts-heading" className="space-y-2">
        <h2 id="concepts-heading" className="text-lg font-semibold">
          Key concepts
        </h2>
        <ul className="space-y-3">
          {draft.keyConcepts.map((concept) => (
            <li key={concept.id} className="rounded-xl border bg-card p-4">
              <h3 className="font-semibold">{concept.title}</h3>
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                {concept.explanation}
              </p>
            </li>
          ))}
        </ul>
      </section>
      {/* Common areas of confusion. */}
      <section aria-labelledby="confusions-heading" className="space-y-2">
        <h2 id="confusions-heading" className="text-lg font-semibold">
          Common areas of confusion
        </h2>
        <ul className="space-y-3">
          {draft.confusionAreas.map((area) => (
            <li key={area.id} className="rounded-xl border bg-card p-4">
              <h3 className="font-semibold">{area.issue}</h3>
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                {area.clarification}
              </p>
            </li>
          ))}
        </ul>
      </section>
      {/* Key topics. */}
      <section aria-labelledby="topics-heading" className="space-y-2">
        <h2 id="topics-heading" className="text-lg font-semibold">
          Key topics
        </h2>
        <ul className="space-y-2">
          {draft.keyTopics.map((topic) => (
            <li key={topic.id}>
              <span className="font-medium">{topic.name}</span>
              {topic.description !== '' && (
                <span className="text-muted-foreground"> — {topic.description}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
