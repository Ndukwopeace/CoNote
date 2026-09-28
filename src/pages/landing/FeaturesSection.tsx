/**
 * The four feature cards (FR-LND-4).
 */

// One icon per feature.
import {
  FolderOpen,
  MessageCircleQuestion,
  NotebookPen,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

// The section's anchor.
import { LANDING_SECTIONS } from '@/lib/routes'

/** One feature: icon, title and description. */
interface Feature {
  // Decorative icon.
  icon: LucideIcon
  // The feature's name, from the brief.
  title: string
  // What it does for the student.
  text: string
}

/** The four features, in the brief's order. */
const FEATURES: Feature[] = [
  {
    icon: NotebookPen,
    title: 'Personal Notes',
    text: 'A private notebook for every class, with formatting, tags and drafts that save as you type.',
  },
  {
    icon: FolderOpen,
    title: 'Course Organization',
    text: 'Notes and summaries sorted by course and class, so revision starts in the right place.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Summaries',
    text: "One clear summary per class, built from the whole class's notes and approved by your teacher.",
  },
  {
    icon: MessageCircleQuestion,
    title: 'Ask CoNote AI',
    text: 'Ask questions about a course or class and get answers grounded in approved summaries and your notes.',
  },
]

/** A grid of four cards. */
export function FeaturesSection() {
  return (
    // Named after its heading; scroll-mt clears the sticky header.
    <section
      id={LANDING_SECTIONS.features}
      aria-labelledby="features-title"
      className="scroll-mt-20 px-4 py-20"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section heading. */}
        <h2 id="features-title" className="text-center text-3xl font-bold tracking-tight">
          Everything you need to learn from every class
        </h2>
        {/* One column on phones, two from 640 px, four from 1024 px. */}
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-xl border bg-card p-6 shadow-xs">
              {/* Icon on a soft brand square. Decorative. */}
              <span className="grid size-10 place-items-center rounded-lg bg-primary-light">
                <Icon aria-hidden="true" className="size-5 text-primary" />
              </span>
              {/* Feature title. */}
              <h3 className="mt-4 font-semibold">{title}</h3>
              {/* Feature description. */}
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
