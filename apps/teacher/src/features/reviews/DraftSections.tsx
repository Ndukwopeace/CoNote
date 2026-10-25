/**
 * The four parts of a summary as text to read (teacher REQUIREMENTS section 9): overview, key
 * concepts, common areas of confusion and key topics. Used for the draft the teacher reads before
 * approving it (D113) and for a published summary, so both always look the same.
 */

// The shape shown.
import type { SummaryDraft } from '@/types/review'

/** The draft's four parts, read-only. */
export function DraftSections({ draft }: Readonly<{ draft: SummaryDraft }>) {
  return (
    <div className="space-y-8">
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
