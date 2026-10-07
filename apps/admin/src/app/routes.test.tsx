/**
 * Tests for the admin route table: every section and detail page opens inside the layout, old
 * entry points redirect, and unknown addresses show a not-found page.
 */

// Queries.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

// The unit under test.
import { routes } from './routes'

/** Renders `path` signed in as an admin. */
function renderAsAdmin(path: string) {
  return renderWithRouter({ routes, path, session: makeSession('admin') })
}

describe('admin routes', () => {
  // Proves each section in the admin brief has a page with its name as the heading.
  it.each([
    ['/admin/dashboard', 'Dashboard'],
    ['/admin/users', 'Users'],
    ['/admin/courses', 'Courses'],
    ['/admin/classes', 'Classes'],
    ['/admin/resources', 'Resources'],
    ['/admin/ai-summaries', 'AI & Summaries'],
    ['/admin/analytics', 'Analytics'],
    ['/admin/audit-logs', 'Audit Logs'],
    ['/admin/settings', 'Settings'],
  ])('opens %s', async (path, heading) => {
    renderAsAdmin(path)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  // Proves each detail address has its page.
  it.each([
    ['/admin/users/u1', 'User details'],
    ['/admin/courses/c1', 'Course details'],
    ['/admin/classes/k1', 'Class details'],
    ['/admin/resources/r1', 'Resource details'],
    ['/admin/ai-summaries/s1', 'Summary pipeline'],
  ])('opens %s', async (path, heading) => {
    renderAsAdmin(path)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  // Proves the bare addresses lead to the dashboard.
  it.each(['/', '/admin'])('sends %s to the dashboard', async (path) => {
    const { router } = renderAsAdmin(path)
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    expect(router.state.location.pathname).toBe('/admin/dashboard')
  })

  // Proves an unknown address inside the console shows not-found, with the navigation kept.
  it('shows not-found for an unknown admin address', async () => {
    renderAsAdmin('/admin/no-such-page')
    await screen.findByRole('heading', { level: 1, name: 'Page not found' })
    expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument()
  })

  // Proves an unknown address outside /admin shows not-found too.
  it('shows not-found for an unknown address outside /admin', async () => {
    renderAsAdmin('/no-such-page')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})

describe('admin layout', () => {
  // Proves the sidebar lists the nine sections and marks the current one.
  it('lists the sections and marks the current one', async () => {
    renderAsAdmin('/admin/courses')
    await screen.findByRole('heading', { level: 1, name: 'Courses' })
    const nav = screen.getByRole('navigation', { name: 'Admin navigation' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Users',
      'Courses',
      'Classes',
      'Resources',
      'AI & Summaries',
      'Analytics',
      'Audit Logs',
      'Settings',
    ])
    expect(within(nav).getByRole('link', { name: 'Courses' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  // Proves a detail page keeps its section marked as current.
  it('keeps the section current on a detail page', async () => {
    renderAsAdmin('/admin/users/u1')
    await screen.findByRole('heading', { level: 1, name: 'User details' })
    const nav = screen.getByRole('navigation', { name: 'Admin navigation' })
    expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
  })

  // Proves the phone menu opens the same navigation in a panel.
  it('opens the navigation from the menu button', async () => {
    const { user } = renderAsAdmin('/admin/dashboard')
    await user.click(await screen.findByRole('button', { name: 'Open navigation' }))
    const panel = await screen.findByRole('dialog', { name: 'Navigation' })
    expect(within(panel).getByRole('link', { name: 'Users' })).toBeInTheDocument()
  })

  // Proves the layout has no detectable accessibility problems.
  it('passes axe', async () => {
    const { container } = renderAsAdmin('/admin/dashboard')
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    await expectNoAxeViolations(container)
  })
})
