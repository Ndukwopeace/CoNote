/**
 * "How CoNote works": the six steps from the brief (FR-LND-3, decision D5).
 */

// One icon per step.
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

// The section's anchor.
import { LANDING_SECTIONS } from '@/lib/routes'

/** One step: its icon, title and one-line explanation. */
interface Step {
  // Decorative icon.
  icon: LucideIcon
  // The step's name, from the brief.
  title: string
  // What happens at this step.
  text: string
}

/** The six steps, in order. */
const STEPS: Step[] = [
  {
    icon: BookOpen,
    title: 'Choose Your Course',
    text: 'Your teacher enrols you, and your courses are waiting when you sign in.',
  },
  {
    icon: CalendarDays,
    title: 'Open Your Class',
    text: 'Each course is split into classes, so notes stay tied to the lesson they came from.',
  },
  {
    icon: NotebookPen,
    title: 'Write Your Personal Notes',
    text: 'Write during or after class. Only you can see your notes.',
  },
  {
    icon: Sparkles,
    title: 'CoNote AI Analyzes',
    text: "CoNote AI combines the class's notes into one draft summary.",
  },
  // The step that makes summaries trustworthy; kept despite the wireframe's five steps (D5).
  {
    icon: ShieldCheck,
    title: 'Teacher Reviews',
    text: 'Your teacher checks and corrects the draft. Nothing is published without approval.',
  },
  {
    icon: GraduationCap,
    title: 'Students Learn',
    text: 'The approved summary appears in your class, ready to read and revise from.',
  },
]

/** The six numbered steps in a grid. */
export function HowItWorksSection() {
  return (
    // aria-labelledby names the region after its heading; scroll-mt clears the sticky header.
    <section
      id={LANDING_SECTIONS.howItWorks}
      aria-labelledby="how-it-works-title"
      className="scroll-mt-20 bg-surface px-4 py-20"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section heading. */}
        <h2 id="how-it-works-title" className="text-center text-3xl font-bold tracking-tight">
          How CoNote works
        </h2>
        {/* One-line intro. */}
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          From your own notes to a summary your teacher has approved, in six steps.
        </p>
        {/* An ordered list, so screen readers announce "1 of 6" and so on. One column on
            phones, two from 640 px, three from 1024 px. */}
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="rounded-xl border bg-card p-6">
              {/* Step number and icon. */}
              <div className="flex items-center gap-3">
                {/* Visible number; the list already gives screen readers the position. */}
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                >
                  {index + 1}
                </span>
                {/* Decorative icon. */}
                <Icon aria-hidden="true" className="size-5 text-primary" />
              </div>
              {/* Step title. */}
              <h3 className="mt-4 font-semibold">{title}</h3>
              {/* Step explanation. */}
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
