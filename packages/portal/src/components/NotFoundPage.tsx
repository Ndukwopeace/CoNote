/**
 * The page for an address a portal doesn't know. Inside the portal's own path it shows within the
 * frame, so the navigation stays; elsewhere it stands alone.
 */

// Icons.
import { ArrowLeft, SearchX } from 'lucide-react'
// Routing.
import { Link } from 'react-router'

// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'

/** What a portal gives its not-found page: its home page, and what to call it. */
interface NotFoundPageProps {
  homePath: string
  homeLabel: string
  // The heading and tab title; "Page not found" for an unknown address, or "Course not found".
  title?: string
  // The line under the heading.
  message?: string
}

/** "Page not found", with a way back home. */
export function NotFoundPage({
  homePath,
  homeLabel,
  title = 'Page not found',
  message = 'The address may be mistyped, or the page may have moved.',
}: Readonly<NotFoundPageProps>) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
      {/* Tab title. */}
      <PageTitle title={title} />
      {/* Decorative icon. */}
      <SearchX aria-hidden="true" className="size-10 text-muted-foreground" />
      {/* The page's h1. */}
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      {/* Why, in plain words. A missing record gives the same answer whether it never existed or
          isn't the user's, so it never says which. */}
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {/* The way back. */}
      <Link
        to={homePath}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {homeLabel}
      </Link>
    </section>
  )
}
