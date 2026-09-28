/**
 * The header and footer around public pages (landing, terms, privacy).
 */

// Link for internal links; Outlet renders the page.
import { Link, Outlet } from 'react-router'

// The CoNote logo.
import { Logo } from '@/components/common/Logo'
// Standard button styles.
import { Button } from '@/components/ui/button'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** Header and footer for public pages. The full landing header arrives in M2. */
export function PublicLayout() {
  return (
    // A column that fills the screen, so the footer stays at the bottom on short pages.
    <div className="flex min-h-dvh flex-col">
      {/* Header bar. */}
      <header className="border-b bg-surface">
        {/* Content capped at 1152 px and centred. */}
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* Logo linking home. */}
          <Link to={ROUTES.landing} className="rounded-md" aria-label="CoNote home">
            <Logo />
          </Link>
          {/* Header actions. */}
          <div className="flex items-center gap-2">
            {/* Sign in: a link styled as a quiet button. */}
            <Button variant="ghost" asChild>
              <Link to={ROUTES.login}>Sign in</Link>
            </Button>
            {/* Get started: the main call to action, going to sign-up. */}
            <Button asChild>
              <Link to={ROUTES.signup}>Get started</Link>
            </Button>
          </div>
        </div>
      </header>
      {/* The page itself; flex-1 makes it take the spare height. */}
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      {/* Footer. */}
      <footer className="border-t bg-surface">
        {/* Stacked on phones, side by side from 640 px. */}
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          {/* Copyright with the current year, and the tagline. */}
          <p>© {new Date().getFullYear()} CoNote. Your notes. Collective understanding.</p>
          {/* Legal links, named so screen readers can tell this navigation apart. */}
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
