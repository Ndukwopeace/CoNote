/**
 * The outermost layout around every page: the page itself plus the app-wide "new version"
 * toast (FR-PWA-5), which must be able to appear on any page. It also hides the launch splash
 * once the first page can show (D61).
 */

// Hides the splash after render.
import { useEffect } from 'react'
// Outlet renders the current page and its own layout.
import { Outlet } from 'react-router'

// Sign-in state: the splash stays while it is still being checked.
import { useAuth } from '@/features/auth/useAuth'
// The launch splash.
import { hideSplash } from '@/features/pwa/splash'
// The update toast.
import { UpdatePrompt } from '@/features/pwa/UpdatePrompt'

/** Every page, plus the update toast. */
export function RootLayout() {
  // Whether sign-in is known yet.
  const { status } = useAuth()

  // This layout renders once the first page's code has loaded. Once sign-in is known too, the
  // page can show its real content, so the splash goes (instead of a loading spinner flashing).
  useEffect(() => {
    if (status !== 'loading') hideSplash(document)
  }, [status])

  return (
    <>
      {/* The page and its layout. */}
      <Outlet />
      {/* Appears only when a new version is waiting. */}
      <UpdatePrompt />
    </>
  )
}
