/**
 * The landing page's first screen (FR-LND-2): the tagline, subtitle, both actions and the
 * dashboard preview.
 */

// Internal links.
import { Link } from 'react-router'

// Standard button.
import { Button } from '@/components/ui/button'
// Route constants.
import { ROUTES } from '@/lib/routes'

// The drawn dashboard.
import { DashboardPreview } from './DashboardPreview'

/** Tagline, subtitle, actions and preview. */
export function HeroSection() {
  return (
    // Pale brand wash behind the hero, fading to the page colour.
    <section className="bg-gradient-to-b from-primary-light/60 to-background px-4 pt-16 pb-24 md:pt-24">
      {/* Text column, centred. */}
      <div className="mx-auto max-w-3xl text-center">
        {/* The tagline as the page's only h1; text-balance evens out the line lengths. */}
        <h1 className="text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
          Your notes. <span className="text-primary">Collective understanding.</span>
        </h1>
        {/* The subtitle from the brief. */}
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Capture your personal notes, organize your learning by course and class, and learn from
          AI-powered summaries created from collective classroom knowledge.
        </p>
        {/* Calls to action: stacked on phones, side by side from 640 px. */}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {/* Main action: create an account. */}
          <Button size="lg" asChild>
            <Link to={ROUTES.signup}>Get Started</Link>
          </Button>
          {/* Secondary action: sign in. */}
          <Button size="lg" variant="outline" asChild>
            <Link to={ROUTES.login}>Sign In</Link>
          </Button>
        </div>
      </div>
      {/* The preview under the text. */}
      <DashboardPreview />
    </section>
  )
}
