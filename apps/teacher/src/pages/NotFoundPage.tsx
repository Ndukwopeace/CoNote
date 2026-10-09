/**
 * The page for an address the portal doesn't know. Inside /teacher it shows within the layout, so
 * the navigation stays; elsewhere it stands alone.
 */

// Icons.
import { ArrowLeft, SearchX } from 'lucide-react'
// Routing.
import { Link } from 'react-router'

// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'

// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

/** "Page not found", with a way back to My courses. */
export function NotFoundPage() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
      {/* Tab title. */}
      <PageTitle title="Page not found" />
      {/* Decorative icon. */}
      <SearchX aria-hidden="true" className="size-10 text-muted-foreground" />
      {/* The page's h1. */}
      <h1 className="mt-4 text-xl font-bold">Page not found</h1>
      {/* Why, in plain words. */}
      <p className="mt-1 text-sm text-muted-foreground">
        The address may be mistyped, or the page may have moved.
      </p>
      {/* The way back. */}
      <Link
        to={TEACHER_ROUTES.courses}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Go to My courses
      </Link>
    </section>
  )
}
