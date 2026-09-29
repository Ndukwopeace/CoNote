/**
 * The card that holds one Settings section: a heading, an optional line under it, and content.
 */

// Type for the content.
import type { ReactNode } from 'react'

/** What a section shows. */
interface SettingsSectionProps {
  // The section heading (an h2, under the page's h1).
  title: string
  // Optional one-line explanation.
  description?: string
  // The content.
  children: ReactNode
}

/** A bordered card with a heading. */
export function SettingsSection({ title, description, children }: Readonly<SettingsSectionProps>) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}
