/**
 * About CoNote (FR-LND-5): note privacy and teacher approval, in plain words.
 */

// The section's anchor.
import { LANDING_SECTIONS } from '@/lib/routes'

/** Three short paragraphs. */
export function AboutSection() {
  return (
    // Named after its heading; scroll-mt clears the sticky header.
    <section
      id={LANDING_SECTIONS.about}
      aria-labelledby="about-title"
      className="scroll-mt-20 bg-surface px-4 py-20"
    >
      {/* Narrow column for comfortable reading. */}
      <div className="mx-auto max-w-3xl space-y-4 text-muted-foreground">
        {/* Section heading. */}
        <h2 id="about-title" className="text-3xl font-bold tracking-tight text-foreground">
          About CoNote
        </h2>
        {/* What it is. */}
        <p>
          CoNote turns the notes a class already takes into one summary everyone can learn from.
          Each student writes in their own words. CoNote AI reads the class&apos;s notes together
          and drafts a summary of what was covered.
        </p>
        {/* Privacy. */}
        <p>
          Your notes stay private. Classmates never see them, and they are used only to build the
          summary for that class.
        </p>
        {/* Teacher approval. */}
        <p>
          A teacher reviews every draft before students see it, correcting mistakes and filling
          gaps. Only teacher-approved summaries are published.
        </p>
      </div>
    </section>
  )
}
