/**
 * The layout for sign in, sign up and the password pages: the logo and the page inside a
 * centred card.
 */

// Link for the logo; Outlet renders the page inside the card.
import { Link, Outlet } from 'react-router'

// The CoNote mark and wordmark.
import { Logo } from '@/components/common/Logo'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** Centred card for sign in, sign up and password pages. */
export function AuthLayout() {
  return (
    // The page's main landmark; id="main" is the skip-link target. Pale brand background.
    <main id="main" className="grid min-h-dvh place-items-center bg-primary-light/60 px-4 py-10">
      {/* The white card, full width on phones and capped on larger screens. */}
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        {/* Logo linking home; the aria-label names the link for screen readers. */}
        <Link to={ROUTES.landing} className="mb-6 inline-flex rounded-md" aria-label="CoNote home">
          <Logo />
        </Link>
        {/* The sign-in, sign-up or password page. */}
        <Outlet />
      </div>
    </main>
  )
}
