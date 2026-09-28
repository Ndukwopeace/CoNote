/**
 * Privacy Policy, at /privacy. Draft wording for the demo; linked from sign-up and the footer.
 */

// The shared legal page layout.
import { LegalPage, type LegalSection } from './LegalPage'

/** The draft policy, section by section. */
const SECTIONS: LegalSection[] = [
  {
    title: 'What we collect',
    body: (
      <p>
        Your name, email address, the courses your school enrols you in, and the notes you write.
      </p>
    ),
  },
  {
    title: 'How your notes are used',
    body: (
      <p>
        Your notes are private to you. CoNote AI reads them, together with your classmates&apos;
        notes, only to draft that class&apos;s summary. A teacher reviews every draft before it is
        published.
      </p>
    ),
  },
  {
    title: 'On shared computers',
    body: (
      <p>
        Signing out removes your session, drafts and conversations from the browser. Leave
        &ldquo;Remember me&rdquo; unticked on computers other people use.
      </p>
    ),
  },
  {
    title: 'Your choices',
    body: (
      <p>
        You can export or delete your notes from Settings. Ask your school to close your account.
      </p>
    ),
  },
]

/** Privacy Policy page. */
export function PrivacyPage() {
  // The shared layout with this page's heading and sections.
  return <LegalPage title="Privacy Policy" sections={SECTIONS} />
}
