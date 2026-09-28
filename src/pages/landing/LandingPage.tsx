/**
 * The public landing page. M1 has the hero only; M2 adds the rest (FR-LND).
 */

// Internal links.
import { Link } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@/components/common/PageTitle'
// Standard button.
import { Button } from '@/components/ui/button'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** Hero only for now. The full landing page (features, how it works, about) arrives in M2. */
export function LandingPage() {
  return (
    // Centred, narrow column with generous vertical space.
    <section className="mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
      {/* Tab title: the tagline. */}
      <PageTitle title="Your notes. Collective understanding." />
      {/* The tagline as the main heading; text-balance evens out line lengths. */}
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
          <Link to={ROUTES.signup}>Get started</Link>
        </Button>
        {/* Secondary action: sign in. */}
        <Button size="lg" variant="outline" asChild>
          <Link to={ROUTES.login}>Sign in</Link>
        </Button>
      </div>
    </section>
  )
}
