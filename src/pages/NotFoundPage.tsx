import { SearchX } from 'lucide-react'
import { Link } from 'react-router'

import { PageTitle } from '@/components/common/PageTitle'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

export function NotFoundPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 text-center">
      <PageTitle title="Page not found" />
      <div className="max-w-md">
        <SearchX aria-hidden="true" className="mx-auto mb-4 size-10 text-primary" />
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          The link may be old, or the page may have moved.
        </p>
        <Button className="mt-6" asChild>
          <Link to={ROUTES.dashboard}>Go to your dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
