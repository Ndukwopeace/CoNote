/**
 * Tests for the signed-in shell: navigation, landmarks, the account menu and accessibility.
 */

// screen queries the page; within narrows a query to one region.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility checker.
import { expectNoAxeViolations } from '@/test/axe'
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
  // Proves the sidebar lists exactly the agreed destinations, in order (decision D6).
  it('shows the six primary destinations in the sidebar', async () => {
    // Arrange: render the portal on the dashboard.
    renderPortal()
    // Arrange: find the sidebar navigation.
    const sidebar = await screen.findByRole('navigation', { name: 'Main navigation' })

    // Act: read every link's visible text.
    const labels = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.textContent.trim())

    // Assert: exact list and order. Notifications may carry its unread badge once it loads.
    expect(labels).toEqual([
      'Home',
      'Courses',
      'Notes',
      'Ask AI',
      expect.stringMatching(/^Notifications\d*$/),
      'Settings',
    ])
  })

  // Proves the sidebar shows the unread count too, and says it to screen readers (FR-NTF-5).
  it('shows the unread count in the sidebar', async () => {
    // Act.
    renderPortal()

    // Assert.
    const sidebar = await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(
      await within(sidebar).findByRole('link', { name: 'Notifications, 3 unread' }),
    ).toHaveAttribute('href', '/notifications')
  })

  // Proves the phone bar holds four places to work (decision D35). Notifications lives on the
  // top-bar bell and Settings in the avatar menu, so each tab gets room for its label.
  it('shows four destinations in the phone bottom bar', async () => {
    // Arrange: render the portal on the dashboard.
    renderPortal()
    // Arrange: find the phone bar.
    const bottomBar = await screen.findByRole('navigation', { name: 'Quick navigation' })

    // Act: read every tab's visible text.
    const labels = within(bottomBar)
      .getAllByRole('link')
      .map((link) => link.textContent.trim())

    // Assert: exactly these four, in order.
    expect(labels).toEqual(['Home', 'Courses', 'Notes', 'Ask AI'])
  })

  // Proves the current tab is shown by more than colour (WCAG 1.4.1): a pill behind its icon
  // and a bolder label, as well as aria-current for screen readers.
  it('marks the current tab with a pill and a bold label, not colour alone', async () => {
    // Arrange: render the portal on the Notes page.
    renderPortal('/notes')
    const bottomBar = await screen.findByRole('navigation', { name: 'Quick navigation' })
    const current = within(bottomBar).getByRole('link', { name: 'Notes' })
    const other = within(bottomBar).getByRole('link', { name: 'Courses' })

    // Assert: announced as current.
    expect(current).toHaveAttribute('aria-current', 'page')
    // Assert: the pill is filled only on the current tab.
    expect(current.querySelector('[data-slot="tab-pill"]')).toHaveAttribute('data-active', 'true')
    expect(other.querySelector('[data-slot="tab-pill"]')).toHaveAttribute('data-active', 'false')
    // Assert: the label is bolder only on the current tab.
    expect(within(current).getByText('Notes')).toHaveClass('font-semibold')
    expect(within(other).getByText('Courses')).not.toHaveClass('font-semibold')
  })

  // Proves the search box says what it searches (recognition rather than recall).
  it('says what the search box searches', async () => {
    // Act.
    renderPortal()

    // Assert.
    expect(
      await screen.findByRole('combobox', { name: 'Search courses, classes and notes' }),
    ).toHaveAttribute('placeholder', 'Find courses & notes')
  })

  // Proves the top bar carries the CoNote logo, linking home.
  it('shows the CoNote logo in the top bar, linking home', async () => {
    // Act.
    renderPortal()

    // Assert.
    const topBar = await screen.findByRole('banner')
    expect(within(topBar).getByRole('link', { name: 'CoNote' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })

  // Proves the bell reaches Notifications and shows the unread count from the service (FR-NTF).
  it('links the bell to Notifications with the unread count', async () => {
    // Act.
    renderPortal()

    // Assert: the top bar's bell carries the demo data's three unread notifications.
    const topBar = await screen.findByRole('banner')
    expect(
      await within(topBar).findByRole('link', { name: 'Notifications, 3 unread' }),
    ).toHaveAttribute('href', '/notifications')
  })

  // Proves screen readers are told which page is current.
  it('marks the current page in the navigation', async () => {
    // Arrange: render the portal on the Notes page.
    renderPortal('/notes')
    // Arrange: find the sidebar navigation.
    const sidebar = await screen.findByRole('navigation', { name: 'Main navigation' })

    // Assert: Notes carries aria-current="page".
    expect(within(sidebar).getByRole('link', { name: 'Notes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  // Proves page content sits in <main>, where the skip link and screen readers expect it.
  it('renders the page inside the main landmark', async () => {
    // Arrange: render the portal on the dashboard.
    renderPortal()

    // Assert: the page text is inside <main>.
    expect(within(await screen.findByRole('main')).getByText('Dashboard content')).toBeVisible()
  })

  // Proves keyboard users can skip past the navigation (NFR-2).
  it('offers a skip link to the main content', async () => {
    // Arrange: render the portal on the dashboard.
    renderPortal()

    // Assert: the skip link points at #main.
    expect(await screen.findByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    )
  })

  // Proves the account menu holds its three items.
  it('opens the account menu with Profile, Settings and Sign out', async () => {
    // Arrange: render the portal and get the simulated user.
    const { user } = renderPortal()

    // Act: open the account menu.
    await user.click(await screen.findByRole('button', { name: /account menu/i }))

    // Assert: all three items are present.
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  // Proves the Profile item navigates.
  it('goes to the profile tab from the account menu', async () => {
    // Arrange: render the portal and get the simulated user.
    const { user } = renderPortal()

    // Act: open the account menu.
    await user.click(await screen.findByRole('button', { name: /account menu/i }))
    // Act: choose Profile.
    await user.click(screen.getByRole('menuitem', { name: 'Profile' }))

    // Assert: the profile tab rendered.
    expect(await screen.findByText('Profile content')).toBeInTheDocument()
  })

  // Proves sign-out from the menu lands on the landing page (decision D21).
  it('signs out to the landing page', async () => {
    // Arrange: render the portal and get the simulated user.
    const { user } = renderPortal()

    // Act: open the account menu.
    await user.click(await screen.findByRole('button', { name: /account menu/i }))
    // Act: choose Sign out.
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    // Assert: on the landing page.
    expect(await screen.findByRole('heading', { name: 'Landing' })).toBeInTheDocument()
  })

  // Proves the shell passes axe's automated accessibility rules.
  it('has no detectable accessibility violations', async () => {
    // Arrange: render and wait for the page.
    const { container } = renderPortal()
    await screen.findByText('Dashboard content')

    // Assert: no violations.
    await expectNoAxeViolations(container)
  })
})

describe('PortalLayout sidebar links', () => {
  // Regression test for the M1 bug where Radix Slot turned NavLink's className function into text.
  it('keep their layout classes when wrapped in a tooltip trigger', async () => {
    // Arrange: render the portal on the Notes page.
    renderPortal('/notes')
    // Arrange: find the sidebar navigation.
    const sidebar = await screen.findByRole('navigation', { name: 'Main navigation' })

    // Act: the Notes link.
    const link = within(sidebar).getByRole('link', { name: 'Notes' })

    // Assert: its layout and active classes arrived as real classes...
    expect(link).toHaveClass('flex', 'items-center', 'bg-primary-light')
    // ...and not as the text of a function.
    expect(link.className).not.toContain('=>')
  })

  // Proves "Notes" stays highlighted on a note's own page.
  it('marks a parent section active on its child pages', async () => {
    // Arrange: render the layout on a child page of Notes.
    renderWithRouter({
      routes: [
        {
          element: <RequireStudent />,
          children: [
            { element: <PortalLayout />, children: [{ path: '/notes/n1', element: <p>note</p> }] },
          ],
        },
      ],
      path: '/notes/n1',
      session: makeSession(),
    })
    // Arrange: find the sidebar navigation.
    const sidebar = await screen.findByRole('navigation', { name: 'Main navigation' })

    // Assert: Notes carries aria-current="page".
    expect(within(sidebar).getByRole('link', { name: 'Notes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
