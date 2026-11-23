/**
 * The plain page around a public form (D126): the CoNote logo and the form in a readable column. No
 * navigation and no sign-in links, because a person opens it from a link they were sent and has no
 * account to use.
 */

// Renders the page inside the column.
import { Outlet } from 'react-router'

// The CoNote mark and wordmark.
import { Logo } from '@conote/ui/common/Logo'
// "You're offline" banner (FR-PWA-4).
import { OfflineBanner } from '@/features/pwa/OfflineBanner'

/** A centred column with the logo above the form. */
export function FormLayout() {
  return (
    // The page's main landmark; id="main" is the skip-link target.
    <main
      id="main"
      className="min-h-dvh bg-primary-light/60 px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10"
    >
      {/* Pinned to the top of the screen while the connection is down (FR-PWA-4). */}
      <div className="fixed inset-x-0 top-0 z-40">
        <OfflineBanner />
      </div>
      <div className="mx-auto w-full max-w-2xl">
        {/* The logo, not a link: there is nowhere in the app for this person to go. */}
        <div className="mb-6">
          <Logo />
        </div>
        {/* The white card the form sits in. */}
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <Outlet />
        </div>
      </div>
    </main>
  )
}
