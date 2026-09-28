import { Link, Outlet } from 'react-router'

import { Logo } from '@/components/common/Logo'
import { ROUTES } from '@/lib/routes'

/** Centred card for sign in, sign up and password pages. */
export function AuthLayout() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-primary-light/60 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <Link to={ROUTES.landing} className="mb-6 inline-flex rounded-md" aria-label="CoNote home">
          <Logo />
        </Link>
        <Outlet />
      </div>
    </main>
  )
}
