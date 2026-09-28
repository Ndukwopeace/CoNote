/**
 * The header and footer around public pages: landing, terms and privacy (FR-LND-1, FR-LND-6).
 * On phones the section links fold into a menu sheet.
 */

// Menu icon for the phone button.
import { Menu } from 'lucide-react'
// Link for internal links; Outlet renders the page.
import { Link, Outlet } from 'react-router'

// The CoNote logo.
import { Logo } from '@/components/common/Logo'
// Standard button styles.
import { Button } from '@/components/ui/button'
// The slide-in panel for the phone menu.
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
// Route constants and the landing page's section anchors.
import { LANDING_SECTIONS, ROUTES } from '@/lib/routes'

/** The header's section links, in display order. */
const SECTION_LINKS = [
  // Feature cards.
  { label: 'Features', hash: LANDING_SECTIONS.features },
  // The six steps.
  { label: 'How It Works', hash: LANDING_SECTIONS.howItWorks },
  // Privacy and teacher approval. Replaces the wireframe's "Pricing" (decision D4).
  { label: 'About', hash: LANDING_SECTIONS.about },
] as const

/** Header and footer for public pages. */
export function PublicLayout() {
  return (
    // A column that fills the screen, so the footer stays at the bottom on short pages.
    <div className="flex min-h-dvh flex-col">
      {/* Header bar; stays at the top while scrolling so the links are always reachable. */}
      <header className="sticky top-0 z-40 border-b bg-surface/95 backdrop-blur">
        {/* Content capped at 1152 px and centred. */}
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          {/* Logo linking home. */}
          <Link to={ROUTES.landing} className="rounded-md" aria-label="CoNote home">
            <Logo />
          </Link>
          {/* Section links, from 768 px up. Named so screen readers can tell navigations apart. */}
          <nav aria-label="Site" className="hidden items-center gap-6 text-sm font-medium md:flex">
            {SECTION_LINKS.map(({ label, hash }) => (
              // Path plus anchor, so the link also works from the legal pages.
              <Link
                key={hash}
                to={{ pathname: ROUTES.landing, hash }}
                className="text-muted-foreground hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
          {/* Account actions, from 768 px up. */}
          <div className="hidden items-center gap-2 md:flex">
            {/* Sign in: a link styled as a quiet button. */}
            <Button variant="ghost" asChild>
              <Link to={ROUTES.login}>Sign In</Link>
            </Button>
            {/* Get started: the main call to action. */}
            <Button asChild>
              <Link to={ROUTES.signup}>Get Started</Link>
            </Button>
          </div>
          {/* Phone menu, below 768 px. */}
          <Sheet>
            {/* The button that opens it. Its name says what it does; the icon is decorative. */}
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu aria-hidden="true" className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              {/* The dialog's name, read out when it opens. */}
              <SheetTitle>Menu</SheetTitle>
              {/* Screen-reader description; hidden visually because the links speak for
                  themselves. */}
              <SheetDescription className="sr-only">
                Jump to a section, or sign in.
              </SheetDescription>
              {/* The section links, stacked. */}
              <nav aria-label="Site sections" className="flex flex-col gap-1">
                {SECTION_LINKS.map(({ label, hash }) => (
                  // SheetClose closes the menu when a link is chosen.
                  <SheetClose asChild key={hash}>
                    <Link
                      to={{ pathname: ROUTES.landing, hash }}
                      className="rounded-md px-2 py-2 font-medium hover:bg-accent"
                    >
                      {label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              {/* Account actions, full width, at the bottom of the list. */}
              <div className="mt-2 flex flex-col gap-2">
                <SheetClose asChild>
                  <Button variant="outline" asChild>
                    <Link to={ROUTES.login}>Sign In</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild>
                    <Link to={ROUTES.signup}>Get Started</Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      {/* The page itself; flex-1 makes it take the spare height. */}
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      {/* Footer (FR-LND-6). */}
      <footer className="border-t bg-surface">
        {/* Stacked on phones, side by side from 640 px. */}
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          {/* Logo and tagline. */}
          <div className="space-y-2">
            <Logo />
            <p>Your notes. Collective understanding.</p>
          </div>
          {/* Legal links and copyright. */}
          <div className="flex flex-col gap-2 sm:items-end">
            {/* Named so screen readers can tell this navigation apart. */}
            <nav aria-label="Legal" className="flex gap-4">
              <Link to={ROUTES.terms} className="hover:text-foreground">
                Terms
              </Link>
              <Link to={ROUTES.privacy} className="hover:text-foreground">
                Privacy
              </Link>
            </nav>
            {/* Copyright with the current year. */}
            <p>© {new Date().getFullYear()} CoNote</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
