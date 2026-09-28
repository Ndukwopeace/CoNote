/**
 * Shared layout for the Terms and Privacy pages: heading, a draft notice and titled sections.
 */

// Type for the section bodies.
import type { ReactNode } from 'react'

// Sets the tab title.
import { PageTitle } from '@/components/common/PageTitle'

/** One titled section of a legal page. */
export interface LegalSection {
  // The section heading.
  title: string
  // The section's paragraphs.
  body: ReactNode
}

/** What a legal page shows. */
interface LegalPageProps {
  // Page heading and tab title.
  title: string
  // The sections, in order.
  sections: LegalSection[]
}

/** A readable column with a draft notice and the sections. */
export function LegalPage({ title, sections }: LegalPageProps) {
  return (
    // Narrow column for comfortable reading.
    <article className="mx-auto max-w-3xl px-4 py-12">
      {/* Tab title. */}
      <PageTitle title={title} />
      {/* The page's only h1. */}
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {/* The draft notice, so nobody mistakes this for reviewed legal text. */}
      <p className="mt-4 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-strong">
        This is a draft for the demo. It has not been reviewed by a lawyer and will be replaced
        before CoNote launches.
      </p>
      {/* The sections. */}
      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-2">
            {/* Section heading. */}
            <h2 className="text-xl font-semibold">{section.title}</h2>
            {/* Section text. */}
            <div className="space-y-2 text-muted-foreground">{section.body}</div>
          </section>
        ))}
      </div>
    </article>
  )
}
