/**
 * The frame for Home (D103): no sidebar, search bar or bottom bar, because Home has its own menu,
 * switch and composer. It puts the app in its dark theme while Home is open.
 */

// The effect that sets and clears the theme.
import { useEffect } from 'react'
// Renders Home.
import { Outlet } from 'react-router'

/** Home's frame. */
export function HomeLayout() {
  // Dark while Home is open. The class goes on <html>, not on a wrapper, so menus and dialogs
  // that the page renders at the end of <body> are dark too. It comes off when Home closes.
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

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
