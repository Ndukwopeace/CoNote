/**
 * The frame for Home (D103): no sidebar or search bar from the portal frame, because Home has
 * its own top bar, switch and composer. The theme is the student's choice like everywhere else
 * (D104); Home no longer forces dark.
 */

// Renders Home.
import { Outlet } from 'react-router'

/** Home's frame. */
export function HomeLayout() {
  return (
    <>
      {/* Skip link: hidden until focused, lets keyboard users jump to the stream. */}
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <Outlet />
    </>
  )
}
