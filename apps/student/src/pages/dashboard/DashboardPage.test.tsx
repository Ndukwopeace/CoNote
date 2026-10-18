/**
 * Tests for Home (D101): the "Let's CoNote" statement and the note form with the class already
 * chosen, over the demo data at a fixed time; and the no-courses, loading and error states
 * (FR-DSH-6).
 */

// Queries.
import { screen, waitFor } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Empty, failing and hanging data.
import { emptyCatalog, failingCatalog, hangingCatalog } from '@/test/catalogServices'
// Layout stand-ins the editor needs in jsdom.
import { installEditorDomStubs } from '@/test/editorDom'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// Service overrides type.
import type { Services } from '@/services/types'

/** Renders the dashboard, signed in, with optional service replacements. */
function renderDashboard(services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path: '/dashboard', session: makeSession(), services })
}

// The editor needs layout calls jsdom lacks.
installEditorDomStubs()

// Only Date is faked, at 9:00 on a Monday, so timers and promises run normally.
beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 28, 9, 0), toFake: ['Date'] })
})

// Back to the real clock.
afterEach(() => {
  vi.useRealTimers()
})

describe('DashboardPage', () => {
  // Proves Home opens on the statement, with a quiet greeting for the time of day and the name.
  it("opens on the Let's CoNote statement", async () => {
    // Act.
    renderDashboard()

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: "Let's CoNote" }),
    ).toBeInTheDocument()
    expect(screen.getByText('Good morning, Victory.')).toBeInTheDocument()
  })

  // Proves the note form is right there, with the class already chosen and no pickers.
  it('shows the note form on the class that is on now', async () => {
    // Act.
    renderDashboard()

    // Assert: the live demo class is chosen, and the body is ready to type in.
    expect(await screen.findByText(/SWE 311 · SDLC Models/)).toBeInTheDocument()
    expect(await screen.findByRole('textbox', { name: 'Note' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Course' })).toBeNull()
    // Home has nowhere to cancel to.
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  // Proves a saved note stays on Home: a link to it, and a fresh form for the next one.
  it('saves a note, stays on Home and starts a fresh note', async () => {
    // Arrange.
    const { user, router } = renderDashboard()
    await user.click(await screen.findByRole('textbox', { name: 'Note' }))
    await user.keyboard('Waterfall is sequential')

    // Act.
    await user.click(screen.getByRole('button', { name: 'Save Note' }))

    // Assert: the link to the class's notes, still on Home, with an empty form.
    const link = await screen.findByRole('link', { name: 'See it in the class' })
    expect(link).toHaveAttribute('href', '/courses/swe-311/classes/swe-311-c4?tab=notes')
    expect(router.state.location.pathname).toBe('/dashboard')
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Note' })).toHaveTextContent('')
    })
  })

  // Proves a student with no courses sees the enrolment message, not a form (FR-DSH-6).
  it('explains when the student has no courses', async () => {
    // Act.
    renderDashboard(emptyCatalog())

    // Assert.
    expect(
      await screen.findByText(
        /You're not enrolled in any courses yet\. Find a course to request to join, or wait for your teacher or administrator to add you\./,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Find courses' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Note' })).toBeNull()
  })

  // Proves loading shows skeletons, not a blank page (section 11).
  it('shows skeletons while loading', async () => {
    // Act.
    renderDashboard(hangingCatalog())

    // Assert: the statement is there straight away; the data area says it's loading.
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('status').some((el) => el.textContent.includes('Loading…'))).toBe(
      true,
    )
  })

  // Proves a failed load explains itself and offers a retry (section 11).
  it('shows an error with a retry when loading fails', async () => {
    // Act.
    renderDashboard(failingCatalog())

    // Assert.
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't reach CoNote/)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderDashboard()
    await screen.findByRole('textbox', { name: 'Note' })

    // Assert.
    await expectNoAxeViolations(container)
  })
})
