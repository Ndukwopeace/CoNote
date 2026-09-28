import { TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errorMessages'
import { toAppError } from '@/lib/errors'
import { reportError } from '@/lib/reportError'
import { ROUTES } from '@/lib/routes'

import { PageTitle } from './PageTitle'

/** Route-level error screen: the failure stays inside one page (ENGINEERING_STANDARDS.md 5). */
export function RouteErrorBoundary() {
  const error = useRouteError()

  useEffect(() => {
    reportError(error, { where: 'RouteErrorBoundary' })
  }, [error])

  return (
    <div role="alert" className="mx-auto grid max-w-md place-items-center px-4 py-16 text-center">
      <PageTitle title="Something went wrong" />
      <TriangleAlert aria-hidden="true" className="mb-4 size-10 text-error" />
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">{errorMessage(toAppError(error))}</p>
      <div className="mt-6 flex gap-3">
        <Button
          onClick={() => {
            window.location.reload()
          }}
        >
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.dashboard}>Go to your dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
