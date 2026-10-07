/**
 * The in-layout panel for a course or class that doesn't exist (REQUIREMENTS.md section 11).
 * The sidebar and top bar stay, so the student can carry on from here.
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
    <section className="flex w-full max-w-5xl flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
      {/* The tab title matches the heading. */}
      <PageTitle title={title} />
      {/* Decorative icon. */}
      <SearchX aria-hidden="true" className="size-10 text-muted-foreground" />
      {/* The page's h1, since this panel replaces the whole page body. */}
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      {/* Why, in plain words. */}
      <p className="mt-1 text-sm text-muted-foreground">
        It may have been removed, or the link may be wrong.
      </p>
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
