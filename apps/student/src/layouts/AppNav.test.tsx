/**
 * Tests for the navigation every signed-in page shares (D104): destinations, the current page,
 * the new-summaries count, the light/dark switch and sign-out.
 */

// Query helpers.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// Accessibility checker.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

// The real guards, so sign-out behaves as in the app.
import { RedirectIfSignedIn } from '@/features/auth/RedirectIfSignedIn'
import { RequireStudent } from '@/features/auth/RequireStudent'

// The component under test.
import { AppNav } from './AppNav'

// A guarded page that shows the navigation, and a landing page to sign out to.
const routes = [
  {
    element: <RequireStudent />,
    children: [
      {
        path: '/courses',
        element: (
          <AppNav newSummaries={2}>
            <p>Class list slot</p>
          </AppNav>
        ),
      },
      { path: '/notes', element: <AppNav newSummaries={0} /> },
    ],
  },
  { element: <RedirectIfSignedIn />, children: [{ path: '/', element: <h1>Landing</h1> }] },
]

describe('AppNav', () => {
  // A clean <html> for each test.
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  // Proves every destination is there, in the order of the approved mockup.
  it('lists Home, Summaries, All notes, Courses, Classes and Settings', async () => {
    renderWithRouter({ routes, path: '/courses', session: makeSession() })
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    const names = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(names).toEqual(['Home', 'Summaries2 new', 'All notes', 'Courses', 'Classes', 'Settings'])
  })

  // Proves the page the student is on is marked, for sight and for screen readers.
  it('marks the current page', async () => {
    renderWithRouter({ routes, path: '/courses', session: makeSession() })
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Courses' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Classes' })).not.toHaveAttribute('aria-current')
  })

  // Proves Summaries and All notes (the same page, two tabs) are not both marked.
  it('marks All notes but not Summaries on the notes page', async () => {
    renderWithRouter({ routes, path: '/notes', session: makeSession() })
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'All notes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: /^Summaries/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  // Proves the Summaries tab is the one marked when it is open.
  it('marks Summaries when its tab is open', async () => {
    renderWithRouter({ routes, path: '/notes?tab=summaries', session: makeSession() })
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: /^Summaries/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'All notes' })).not.toHaveAttribute('aria-current')
  })

  // Proves a page can put its own section (Home's classes) above the links.
  it('shows what a page puts in it', async () => {
    renderWithRouter({ routes, path: '/courses', session: makeSession() })
    expect(await screen.findByText('Class list slot')).toBeInTheDocument()
  })

  // Proves the switch offers the other theme, applies it, and says so.
  it('switches between light and dark', async () => {
    const { user } = renderWithRouter({ routes, path: '/courses', session: makeSession() })
    await user.click(await screen.findByRole('button', { name: 'Dark mode' }))
    expect(document.documentElement).toHaveClass('dark')
    await user.click(screen.getByRole('button', { name: 'Light mode' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  // Proves signing out goes through the guard to the landing page.
  it('signs out', async () => {
    const { user } = renderWithRouter({ routes, path: '/courses', session: makeSession() })
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Landing' })).toBeInTheDocument()
  })

  // Proves the navigation has no accessibility violations.
  it('is accessible', async () => {
    const { container } = renderWithRouter({ routes, path: '/courses', session: makeSession() })
    await screen.findByRole('navigation', { name: 'Main' })
    await expectNoAxeViolations(container)
  })
})
