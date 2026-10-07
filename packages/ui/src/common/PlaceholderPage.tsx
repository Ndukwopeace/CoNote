/**
 * A temporary page body shown until the real page is built. It says "Coming soon" rather than
 * naming the team's milestone, which would mean nothing to the person using the app.
 */

// Construction-sign icon.
import { Construction } from 'lucide-react'
// Type for optional extra content.
import type { ReactNode } from 'react'

// Sets the browser tab title.
import { PageTitle } from './PageTitle'

/** What a placeholder shows. */
interface PlaceholderPageProps {
  // Page heading and tab title.
  title: string
  // What the finished page will do.
  description: string
  // Optional content under the heading, e.g. the dashboard greeting.
  children?: ReactNode
}

/** Stands in for a page until it is built, so routing can be tested end to end. */
export function PlaceholderPage({ title, description, children }: Readonly<PlaceholderPageProps>) {
  return (
    // Left-aligned column, as in the wireframes.
    <section className="w-full max-w-5xl">
      {/* Browser tab title. */}
      <PageTitle title={title} />
      {/* The page's single h1. Tests and screen readers find pages by it. */}
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      {/* Any extra content. */}
      {children}
      {/* The "coming soon" card; a dashed border marks it as temporary. */}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed bg-card p-6">
        {/* Decorative icon. */}
        <Construction aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          {/* Plain words for users; the milestones doc says which milestone builds it. */}
          <p className="font-semibold">Coming soon</p>
          {/* What the page will do. */}
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </section>
  )
}
