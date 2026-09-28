/**
 * The screen shown when a page crashes. The problem stays inside that page: the navigation keeps
 * working and the student gets a way forward.
 */

// Warning icon.
import { TriangleAlert } from 'lucide-react'
// Reports the error once, after render.
import { useEffect } from 'react'
// Link for the dashboard button; useRouteError returns what the page threw.
import { Link, useRouteError } from 'react-router'

// Standard button.
import { Button } from '@/components/ui/button'
// Student-facing wording per error kind.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown into an AppError.
import { toAppError } from '@/lib/errors'
// Sends the error to the reporter.
import { reportError } from '@/lib/reportError'
// Route constants.
import { ROUTES } from '@/lib/routes'

// Sets the tab title.
import { PageTitle } from './PageTitle'

/** Route-level error screen: the failure stays inside one page (ENGINEERING_STANDARDS.md 5). */
export function RouteErrorBoundary() {
  // Whatever the crashed page threw.
  const error = useRouteError()

  // Report the error once per distinct error, not on every re-render.
  useEffect(() => {
    reportError(error, { where: 'RouteErrorBoundary' })
  }, [error])

  return (
    // role="alert" makes screen readers announce the problem straight away.
    <div role="alert" className="mx-auto grid max-w-md place-items-center px-4 py-16 text-center">
      {/* Tab title. */}
      <PageTitle title="Something went wrong" />
      {/* Decorative warning icon. */}
      <TriangleAlert aria-hidden="true" className="mb-4 size-10 text-error" />
      {/* Heading. */}
      <h1 className="text-xl font-bold">Something went wrong</h1>
      {/* SECURITY: only the safe, student-facing message is shown, never the raw error, which
          could reveal stack traces or internal details. */}
      <p className="mt-2 text-muted-foreground">{errorMessage(toAppError(error))}</p>
      {/* Ways forward. */}
      <div className="mt-6 flex gap-3">
        {/* Reload the page; many errors are temporary. */}
        <Button
          onClick={() => {
            window.location.reload()
          }}
        >
          Try again
        </Button>
        {/* Or leave for a known-good page. */}
        <Button variant="outline" asChild>
          <Link to={ROUTES.dashboard}>Go to your dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
