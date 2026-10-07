/**
 * Terms of Service, at /terms. Draft wording for the demo; linked from sign-up and the footer.
 */

// The shared legal page layout.
import { LegalPage, type LegalSection } from './LegalPage'

/** The draft terms, section by section. */
const SECTIONS: LegalSection[] = [
  {
    title: 'Who can use CoNote',
    body: <p>CoNote is for students enrolled by their school. You need an account to use it.</p>,
  },
  {
    title: 'Your notes',
    body: (
      <p>
        You own the notes you write. You let CoNote use them to build the summary for the class they
        belong to. Classmates never see your notes.
      </p>
    ),
  },
  {
    title: 'Summaries',
    body: (
      <p>
        Summaries are drafted by CoNote AI and approved by a teacher before students see them. They
        are study aids, not a replacement for your course materials.
      </p>
    ),
  },
  {
    title: 'Acceptable use',
    body: (
      <p>
        Don&apos;t share your account, try to reach other students&apos; notes, or upload anything
        unlawful or harmful.
      </p>
    ),
  },
]

/** Terms of Service page. */
export function TermsPage() {
  // The shared layout with this page's heading and sections.
  return <LegalPage title="Terms of Service" sections={SECTIONS} />
}
