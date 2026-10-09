/**
 * The in-frame panel for a course or summary that doesn't exist, or isn't the teacher's
 * (teacher REQUIREMENTS section 11). The sidebar and top bar stay, so the teacher can carry on.
 */

// Icons: a search glass for "missing", an arrow for the back link.
import { ArrowLeft, SearchX } from 'lucide-react'
// Client-side link.
import { Link } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'

/** What the panel shows. */
interface NotFoundPanelProps {
  // Heading, e.g. "Course not found".
  title: string
  // Where the back link goes.
  backTo: string
  // The back link's words.
  backLabel: string
}

/** A heading, one sentence and a way back. */
export function NotFoundPanel({ title, backTo, backLabel }: Readonly<NotFoundPanelProps>) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
      {/* The tab title matches the heading. */}
      <PageTitle title={title} />
      {/* Decorative icon. */}
      <SearchX aria-hidden="true" className="size-10 text-muted-foreground" />
      {/* The page's h1, since this panel replaces the whole page body. */}
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      {/* Why, in plain words. It never says which: the answer is the same for a course that
          doesn't exist and one that isn't the teacher's. */}
      <p className="mt-1 text-sm text-muted-foreground">We couldn&apos;t find that.</p>
      {/* The way back. */}
      <Link
        to={backTo}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {backLabel}
      </Link>
    </section>
  )
}
