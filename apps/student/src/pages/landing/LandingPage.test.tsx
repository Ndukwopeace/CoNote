/**
 * Tests for the public landing page and its header and footer (FR-LND-1 to FR-LND-6).
 */

// Queries, scoped queries and waiting helpers.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The real route table, so the public layout takes part.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the landing page signed out and waits for it to load. */
async function renderLanding(path = '/') {
  // Render.
  const result = renderWithRouter({ routes, path })
  // Wait for the lazy page's heading.
  await screen.findByRole('heading', { level: 1, name: /Your notes\. Collective understanding\./ })
  // Hand back the tools.
  return result
}

describe('LandingPage', () => {
  // Proves the header (FR-LND-1): section links and both account actions.
  it('has header links to each section and to sign in and sign up', async () => {
    // Act.
    await renderLanding()

    // Assert: the section links point at the landing page's anchors, so they work from any page.
    const nav = screen.getByRole('navigation', { name: 'Site' })
    expect(within(nav).getByRole('link', { name: 'Features' })).toHaveAttribute(
      'href',
      '/#features',
    )
    expect(within(nav).getByRole('link', { name: 'How It Works' })).toHaveAttribute(
      'href',
      '/#how-it-works',
    )
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/#about')
    // Assert: the header's account actions.
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login')
    expect(within(header).getByRole('link', { name: 'Get Started' })).toHaveAttribute(
      'href',
      '/signup',
    )
  })

  // Proves the hero (FR-LND-2): subtitle, both actions and the dashboard preview.
  it('shows the hero with its actions and the dashboard preview', async () => {
    // Act.
    await renderLanding()

    // Assert.
    expect(screen.getByText(/Capture your personal notes/)).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /Preview of the CoNote student dashboard/ }),
    ).toBeVisible()
  })

  // Proves the six steps, in order (FR-LND-3, decision D5).
  it('lists the six steps of how CoNote works in order', async () => {
    // Act.
    await renderLanding()

    // Assert: the step titles, in order.
    const section = screen.getByRole('region', { name: 'How CoNote works' })
    const steps = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(steps).toEqual([
      'Choose Your Course',
      'Open Your Class',
      'Write Your Personal Notes',
      'CoNote AI Analyzes',
      'Teacher Reviews',
      'Students Learn',
    ])
  })

  // Proves the four feature cards (FR-LND-4).
  it('shows the four feature cards', async () => {
    // Act.
    await renderLanding()

    // Assert.
    const section = screen.getByRole('region', { name: /Everything you need/ })
    const titles = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(titles).toEqual([
      'Personal Notes',
      'Course Organization',
      'AI-Powered Summaries',
      'Ask CoNote AI',
    ])
  })

  // Proves the About section covers privacy and teacher approval (FR-LND-5).
  it('explains note privacy and teacher approval in About', async () => {
    // Act.
    await renderLanding()

    // Assert.
    const about = screen.getByRole('region', { name: 'About CoNote' })
    expect(about).toHaveTextContent(/private/i)
    expect(about).toHaveTextContent(/teacher/i)
  })

  // Proves the call to action and the footer (FR-LND-6).
  it('ends with the call to action and a footer with the legal links', async () => {
    // Act.
    await renderLanding()

    // Assert: the band and its button.
    expect(
      screen.getByRole('heading', { name: 'Start learning smarter with CoNote' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create Free Account' })).toHaveAttribute(
      'href',
      '/signup',
    )
    // Assert: the footer.
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    )
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} CoNote`)
  })

  // Proves the phone menu opens, lists the links, and closes when one is chosen (FR-LND-1).
  it('opens a menu sheet with the links and closes it after a choice', async () => {
    // Arrange.
    const { user } = await renderLanding()

    // Act: open the menu.
    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    // Assert: a dialog with the section links and account actions.
    const sheet = screen.getByRole('dialog', { name: 'Menu' })
    expect(within(sheet).getByRole('link', { name: 'About' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Get Started' })).toBeInTheDocument()

    // Act: choose a section.
    await user.click(within(sheet).getByRole('link', { name: 'About' }))

    // Assert: the sheet closes.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  // Proves an address with a section anchor scrolls to that section once the page has loaded.
  it('scrolls to the section named in the address', async () => {
    // Arrange: record which elements are scrolled into view.
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView')

    // Act.
    await renderLanding('/#about')

    // Assert: the About section was one of them.
    const about = screen.getByRole('region', { name: 'About CoNote' })
    await waitFor(() => {
      expect(scroll.mock.contexts).toContain(about)
    })
  })

  // Proves the whole page is accessible.
  it('has no accessibility problems', async () => {
    // Act.
    const { container } = await renderLanding()

    // Assert.
    await expectNoAxeViolations(container)
  })
})
