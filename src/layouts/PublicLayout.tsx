import { Link, Outlet } from 'react-router'

import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

/** Header and footer for public pages. The full landing header arrives in M2. */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to={ROUTES.landing} className="rounded-md" aria-label="CoNote home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to={ROUTES.login}>Sign in</Link>
            </Button>
            <Button asChild>
              <Link to={ROUTES.signup}>Get started</Link>
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} CoNote. Your notes. Collective understanding.</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link to={ROUTES.terms} className="hover:text-foreground">
              Terms
            </Link>
            <Link to={ROUTES.privacy} className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
