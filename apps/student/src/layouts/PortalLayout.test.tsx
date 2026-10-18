/**
 * Tests for the signed-in shell (D104): the shared navigation as a sidebar and as the phone
 * drawer, landmarks, the top bar, the account menu and accessibility.
 */

// screen queries the page; within narrows a query to one region.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility checker.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

// The real guards, so sign-out behaves as in the app.
import { RedirectIfSignedIn } from '@/features/auth/RedirectIfSignedIn'
import { RequireStudent } from '@/features/auth/RequireStudent'

// The layout under test.
import { PortalLayout } from './PortalLayout'

// Three portal pages behind the real guard, plus a landing page to sign out to.
const routes = [
  {
    element: <RequireStudent />,
    children: [
      {
        element: <PortalLayout />,
        children: [
          { path: '/dashboard', element: <h1>Dashboard content</h1> },
          { path: '/notes', element: <h1>Notes content</h1> },
          { path: '/courses', element: <h1>Courses content</h1> },
          { path: '/courses/c1', element: <h1>One course content</h1> },
          { path: '/settings/profile', element: <h1>Profile content</h1> },
        ],
      },
    ],
  },
  {
    element: <RedirectIfSignedIn />,
    children: [{ path: '/', element: <h1>Landing</h1> }],
  },
]

/** Renders the portal at `path`, signed in as Victory. */
function renderPortal(path = '/dashboard') {
  // Signed in, so the guard lets the layout render.
  return renderWithRouter({ routes, path, session: makeSession({ fullName: 'Victory Okafor' }) })
}

describe('PortalLayout', () => {
  // Proves the sidebar is the shared navigation: the same six destinations as Home's.
  it('shows the shared navigation in the sidebar', async () => {
    renderPortal('/courses')
    const sidebar = await screen.findByRole('navigation', { name: 'Main' })

    const labels = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.textContent.trim())

    // Summaries may carry its "n new" count once the summaries load.
    expect(labels).toEqual([
      'Home',
      expect.stringMatching(/^Summaries(\d+ new)?$/),
      'All notes',
      'Courses',
      'Classes',
      'Settings',
    ])
  })

  // Proves the bottom tab bar is gone: phones use the drawer like Home does.
  it('has no bottom navigation bar', async () => {
    renderPortal('/courses')
    await screen.findByRole('navigation', { name: 'Main' })

    expect(screen.queryByRole('navigation', { name: 'Quick navigation' })).toBeNull()
  })

  // Proves the phone menu opens the same navigation in a drawer, and choosing a place closes it.
  it('opens the navigation in a drawer from the menu button and closes it after a choice', async () => {
    const { user } = renderPortal('/courses')
    await user.click(await screen.findByRole('button', { name: 'Open menu' }))

    const drawer = await screen.findByRole('dialog', { name: 'Menu' })
    await user.click(within(drawer).getByRole('link', { name: 'All notes' }))

    expect(await screen.findByRole('heading', { name: 'Notes content' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
  })

  // Proves the search box says what it searches (recognition rather than recall).
  it('says what the search box searches', async () => {
    renderPortal()

    expect(
      await screen.findByRole('combobox', { name: 'Search courses, classes and notes' }),
    ).toHaveAttribute('placeholder', 'Find courses & notes')
  })

  // Proves the bell reaches Notifications and shows the unread count from the service (FR-NTF).
  it('links the bell to Notifications with the unread count', async () => {
    renderPortal()

    // The top bar's bell carries the demo data's three unread notifications.
    const topBar = await screen.findByRole('banner')
    expect(
      await within(topBar).findByRole('link', { name: 'Notifications, 3 unread' }),
    ).toHaveAttribute('href', '/notifications')
  })

  // Proves screen readers are told which page is current.
  it('marks the current page in the navigation', async () => {
    renderPortal('/courses')
    const sidebar = await screen.findByRole('navigation', { name: 'Main' })

    expect(within(sidebar).getByRole('link', { name: 'Courses' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  // Proves "Courses" stays marked on a course's own page.
  it('marks a parent section active on its child pages', async () => {
    renderPortal('/courses/c1')
    const sidebar = await screen.findByRole('navigation', { name: 'Main' })

    expect(within(sidebar).getByRole('link', { name: 'Courses' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  // Proves the light/dark switch is on every page, not only on Home, and the theme stays.
  it('switches the theme from any page', async () => {
    const { user } = renderPortal('/courses')

    await user.click(await screen.findByRole('button', { name: 'Dark mode' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('button', { name: 'Light mode' })).toBeInTheDocument()
  })

  // Proves page content sits in <main>, where the skip link and screen readers expect it.
  it('renders the page inside the main landmark', async () => {
    renderPortal()

    expect(within(await screen.findByRole('main')).getByText('Dashboard content')).toBeVisible()
  })

  // Proves keyboard users can skip past the navigation (NFR-2).
  it('offers a skip link to the main content', async () => {
    renderPortal()

    expect(await screen.findByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    )
  })

  // Proves the account menu holds its three items.
  it('opens the account menu with Profile, Settings and Sign out', async () => {
    const { user } = renderPortal()

    await user.click(await screen.findByRole('button', { name: /account menu/i }))

    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  // Proves the Profile item navigates.
  it('goes to the profile tab from the account menu', async () => {
    const { user } = renderPortal()

    await user.click(await screen.findByRole('button', { name: /account menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Profile' }))

    expect(await screen.findByText('Profile content')).toBeInTheDocument()
  })

  // Proves sign-out from the menu lands on the landing page (decision D21).
  it('signs out to the landing page', async () => {
    const { user } = renderPortal()

    await user.click(await screen.findByRole('button', { name: /account menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Landing' })).toBeInTheDocument()
  })

  // Proves the shell passes axe's automated accessibility rules.
  it('has no detectable accessibility violations', async () => {
    const { container } = renderPortal()
    await screen.findByText('Dashboard content')

    await expectNoAxeViolations(container)
  })
})
