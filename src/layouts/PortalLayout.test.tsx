import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { expectNoAxeViolations } from '@/test/axe'
import { makeSession } from '@/test/factories'
import { renderWithRouter } from '@/test/renderWithRouter'

import { RedirectIfSignedIn } from '@/features/auth/RedirectIfSignedIn'
import { RequireStudent } from '@/features/auth/RequireStudent'

import { PortalLayout } from './PortalLayout'

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

function renderPortal(path = '/dashboard') {
  return renderWithRouter({ routes, path, session: makeSession({ fullName: 'Victory Okafor' }) })
}

describe('PortalLayout', () => {
  it('shows the six primary destinations in the sidebar', async () => {
    renderPortal()
    const sidebar = await screen.findByRole('navigation', { name: 'Main navigation' })

    const labels = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.textContent.trim())

    expect(labels).toEqual(['Dashboard', 'Courses', 'Notes', 'Ask AI', 'Notifications', 'Settings'])
  })

  it('shows five destinations in the phone bottom bar, leaving Settings to the avatar menu', async () => {
    renderPortal()
    const bottomBar = await screen.findByRole('navigation', { name: 'Quick navigation' })

    expect(within(bottomBar).getAllByRole('link')).toHaveLength(5)
    expect(within(bottomBar).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('marks the current page in the navigation', async () => {
    renderPortal('/notes')
    const sidebar = await screen.findByRole('navigation', { name: 'Main navigation' })

    expect(within(sidebar).getByRole('link', { name: 'Notes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders the page inside the main landmark', async () => {
    renderPortal()

    expect(within(await screen.findByRole('main')).getByText('Dashboard content')).toBeVisible()
  })

  it('offers a skip link to the main content', async () => {
    renderPortal()

    expect(await screen.findByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    )
  })

  it('opens the account menu with Profile, Settings and Sign out', async () => {
    const { user } = renderPortal()

    await user.click(await screen.findByRole('button', { name: /account menu/i }))

    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('goes to the profile tab from the account menu', async () => {
    const { user } = renderPortal()

    await user.click(await screen.findByRole('button', { name: /account menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Profile' }))

    expect(await screen.findByText('Profile content')).toBeInTheDocument()
  })

  it('signs out to the landing page', async () => {
    const { user } = renderPortal()

    await user.click(await screen.findByRole('button', { name: /account menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Landing' })).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderPortal()
    await screen.findByText('Dashboard content')

    await expectNoAxeViolations(container)
  })
})

describe('PortalLayout sidebar links', () => {
  it('keep their layout classes when wrapped in a tooltip trigger', async () => {
    renderPortal('/notes')
    const sidebar = await screen.findByRole('navigation', { name: 'Main navigation' })

    const link = within(sidebar).getByRole('link', { name: 'Notes' })

    expect(link).toHaveClass('flex', 'items-center', 'bg-primary-light')
    expect(link.className).not.toContain('=>')
  })

  it('marks a parent section active on its child pages', async () => {
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
    const sidebar = await screen.findByRole('navigation', { name: 'Main navigation' })

    expect(within(sidebar).getByRole('link', { name: 'Notes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
