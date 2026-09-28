/**
 * The outermost layout around every page: the page itself plus the app-wide "new version"
 * toast (FR-PWA-5), which must be able to appear on any page.
 */

// Outlet renders the current page and its own layout.
import { Outlet } from 'react-router'

// The update toast.
import { UpdatePrompt } from '@/features/pwa/UpdatePrompt'

/** Every page, plus the update toast. */
export function RootLayout() {
  return (
    <>
      {/* The page and its layout. */}
      <Outlet />
      {/* Appears only when a new version is waiting. */}
      <UpdatePrompt />
    </>
  )
}
