import { Link } from 'react-router'

import { PageTitle } from '@/components/common/PageTitle'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

/** Hero only for now. The full landing page (features, how it works, about) arrives in M2. */
export function LandingPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
      <PageTitle title="Your notes. Collective understanding." />
      <h1 className="text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
        Your notes. <span className="text-primary">Collective understanding.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
        Capture your personal notes, organize your learning by course and class, and learn from
        AI-powered summaries created from collective classroom knowledge.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button size="lg" asChild>
          <Link to={ROUTES.signup}>Get started</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link to={ROUTES.login}>Sign in</Link>
        </Button>
      </div>
    </section>
  )
}
