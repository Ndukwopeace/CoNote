/**
 * Shown for any address that matches no route.
 */

// "Nothing found" icon.
import { SearchX } from 'lucide-react'
// Internal link.
import { Link } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Standard button.
import { Button } from '@conote/ui/button'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** The 404 page, with a way back into the app. */
export function NotFoundPage() {
  return (
    // Main landmark, centred on the screen.
    <main id="main" className="grid min-h-dvh place-items-center px-4 text-center">
      {/* Tab title. */}
      <PageTitle title="Page not found" />
      <div className="max-w-md">
        {/* Decorative icon. */}
        <SearchX aria-hidden="true" className="mx-auto mb-4 size-10 text-primary" />
        {/* Heading. */}
        <h1 className="text-2xl font-bold">Page not found</h1>
        {/* Likely reasons. */}
        <p className="mt-2 text-muted-foreground">
          The link may be old, or the page may have moved.
        </p>
        {/* Way back. A signed-out visitor is sent on to sign in by the guard. */}
        <Button className="mt-6" asChild>
          <Link to={ROUTES.dashboard}>Go to your dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
