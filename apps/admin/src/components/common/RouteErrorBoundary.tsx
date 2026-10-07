/**
 * The screen shown when a console page crashes. The problem stays inside that page and the
 * administrator gets a way forward (ENGINEERING_STANDARDS.md 5).
 */

// Warning icon.
import { TriangleAlert } from 'lucide-react'
// Reports the error once, after render.
import { useEffect } from 'react'
// Link to the dashboard; useRouteError returns what the page threw.
import { Link, useRouteError } from 'react-router'

// Normalises anything thrown into an AppError.
import { toAppError } from '@conote/core/errors'
// Sends the error to the reporter.
import { reportError } from '@conote/core/reportError'
// Standard button.
import { Button } from '@conote/ui/button'
// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'

// Administrator-facing wording.
import { errorMessage } from '@/lib/errorMessages'
// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

/** Route-level error screen. */
export function RouteErrorBoundary() {
  // Whatever the crashed page threw.
  const error = useRouteError()

  // Report each distinct error once, not on every re-render.
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
      {/* SECURITY: only the safe wording is shown, never the raw error (stack traces, internals). */}
      <p className="mt-2 text-muted-foreground">{errorMessage(toAppError(error))}</p>
      {/* Ways forward. */}
      <div className="mt-6 flex gap-3">
        {/* Reload; many errors are temporary. */}
        <Button
          onClick={() => {
            window.location.reload()
          }}
        >
          Try again
        </Button>
        {/* Or leave for a known-good page. */}
        <Button variant="outline" asChild>
          <Link to={ADMIN_ROUTES.dashboard}>Go to the dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
