import { Construction } from 'lucide-react'
import type { ReactNode } from 'react'

import { PageTitle } from './PageTitle'

interface PlaceholderPageProps {
  title: string
  /** The build milestone that delivers this page (docs/MILESTONES.md). */
  milestone: string
  description: string
  children?: ReactNode
}

/** Stands in for a page until its milestone lands, so routing can be tested end to end. */
export function PlaceholderPage({ title, milestone, description, children }: PlaceholderPageProps) {
  return (
    <section className="w-full max-w-5xl">
      <PageTitle title={title} />
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      {children}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed bg-card p-6">
        <Construction aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold">Coming in {milestone}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </section>
  )
}
