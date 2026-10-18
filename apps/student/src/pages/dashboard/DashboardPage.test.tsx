/**
 * Tests for Home (D101, D102): the "Let's CoNote" statement, the stream of the chosen class's
 * notes, the composer with the class chip and tags, the class sheet, the summary card and the
 * Ask mode, over the demo data at a fixed time; and the no-courses, loading and error states
 * (FR-DSH-6).
 */

// Queries.
import { screen, within } from '@testing-library/react'
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
// Session and class factories.
import { makeClass, makeSession } from '@/test/factories'
// Render helper.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'
// The error type.
import { AppError } from '@conote/core/errors'
// Service overrides type.
import type { Services } from '@/services/types'

/** Renders the dashboard, signed in, with optional service replacements. */
function renderDashboard(services: Partial<Services> = {}, path = '/dashboard') {
  return renderWithRouter({ routes, path, session: makeSession(), services })
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

describe('DashboardPage: Note mode', () => {
  // Proves Home opens on the statement, with a quiet greeting for the time of day and the name.
  it("opens on the Let's CoNote statement", async () => {
    renderDashboard()
    expect(
      await screen.findByRole('heading', { level: 1, name: "Let's CoNote" }),
    ).toBeInTheDocument()
    expect(screen.getByText('Good morning, Victory.')).toBeInTheDocument()
  })

  // Proves the class on now is chosen for the student, shown on the chip, and its notes make the
  // stream; the composer is there with the preset tags.
  it('shows the class on now, its notes and the composer', async () => {
    renderDashboard()

    expect(
      await screen.findByRole('button', { name: /Class: SWE 311 · SDLC Models/ }),
    ).toBeVisible()
    expect(await screen.findByText(/Each phase finishes before the next starts/)).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Note' })).toBeVisible()
    for (const tag of ['Key concept', 'Question', 'Example', 'Aha moment']) {
      expect(screen.getByRole('button', { name: tag })).toHaveAttribute('aria-pressed', 'false')
    }
    // Home has no class picker on the page itself.
    expect(screen.queryByRole('combobox', { name: 'Course' })).toBeNull()
  })

  // Proves sending a note with Enter files it under the chosen class, shows it in the stream and
  // empties the composer, without leaving Home.
  it('saves a note with Enter and shows it in the stream', async () => {
    const { user, router } = renderDashboard()
    const box = await screen.findByRole('textbox', { name: 'Note' })

    await user.type(box, 'Agile favours working software{Enter}')

    expect(await screen.findByText('Agile favours working software')).toBeVisible()
    expect(box).toHaveValue('')
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  // Proves a tapped tag goes on the next note only.
  it('tags the next note with the chosen tag', async () => {
    const { user } = renderDashboard()
    const box = await screen.findByRole('textbox', { name: 'Note' })

    await user.click(screen.getByRole('button', { name: 'Example' }))
    expect(screen.getByRole('button', { name: 'Example' })).toHaveAttribute('aria-pressed', 'true')
    await user.type(box, 'Spiral model{Enter}')

    const bubble = (await screen.findByText('Spiral model')).closest('li')
    expect(bubble).not.toBeNull()
    expect(within(bubble as HTMLElement).getByText(/Example/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Example' })).toHaveAttribute('aria-pressed', 'false')
  })

  // SECURITY: typed markup is shown as text, never run or rendered.
  it('shows typed markup as text', async () => {
    const { user } = renderDashboard()
    await user.type(await screen.findByRole('textbox', { name: 'Note' }), '<b>bold</b>{Enter}')
    expect(await screen.findByText('<b>bold</b>')).toBeVisible()
  })

  // Proves the class sheet lists started classes and choosing one moves the chip and the stream.
  it('changes the class from the chip', async () => {
    const { user } = renderDashboard()
    await user.click(await screen.findByRole('button', { name: /Class: SWE 311 · SDLC Models/ }))

    const sheet = await screen.findByRole('dialog', { name: 'Which class?' })
    expect(within(sheet).getByText('On now')).toBeVisible()
    await user.click(
      within(sheet).getByRole('button', { name: /Citing Sources|Software Requirements/ }),
    )

    expect(screen.queryByRole('dialog', { name: 'Which class?' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Class: SWE 311 · SDLC Models/ })).toBeNull()
  })

  // Proves the "+" menu: a title on request, a way to the full editor, and the photo option shown
  // as not ready.
  it('offers a title and the full editor from the plus menu', async () => {
    const { user } = renderDashboard()
    await user.click(await screen.findByRole('button', { name: 'More options' }))

    expect(screen.getByRole('menuitem', { name: 'Open the full editor' })).toHaveAttribute(
      'href',
      '/notes/new?classId=swe-311-c4',
    )
    expect(screen.getByRole('menuitem', { name: /Photo of the board/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await user.click(screen.getByRole('menuitem', { name: 'Add a title' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Spiral')
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Risk first{Enter}')

    expect(await screen.findByText('Risk first')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('')
  })

  // Proves a refused save is explained, and what was typed is kept.
  it('keeps the text and explains when saving fails', async () => {
    const base = createTestServices().notes
    const { user } = renderDashboard({
      notes: {
        ...base,
        createNote: () => Promise.reject(new AppError('network', 'offline')),
      },
    })
    const box = await screen.findByRole('textbox', { name: 'Note' })

    await user.type(box, 'Will not save{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't reach CoNote/)
    expect(box).toHaveValue('Will not save')
  })

  // Proves that with no class started yet the chip asks for one, and sending opens the sheet
  // instead of guessing, keeping the text.
  it('asks for a class when none has started', async () => {
    const base = createTestServices().classes
    const { user } = renderDashboard({
      classes: { ...base, listMyClasses: () => Promise.resolve([makeClass()]) },
    })
    expect(await screen.findByRole('button', { name: 'Choose a class' })).toBeVisible()
    expect(screen.getByText('Choose a class below, then type a thought.')).toBeVisible()

    await user.type(await screen.findByRole('textbox', { name: 'Note' }), 'Early thought{Enter}')

    expect(await screen.findByRole('dialog', { name: 'Which class?' })).toBeVisible()
    // The sheet hides the page from the accessibility tree while it is open.
    expect(screen.getByRole('textbox', { name: 'Note', hidden: true })).toHaveValue('Early thought')
  })

  // Proves a class with a published summary shows it in the stream, with the way to read it and
  // to ask about it (which switches to Ask on that class).
  it('shows the approved summary in the stream and opens Ask from it', async () => {
    const { user, router } = renderDashboard({}, '/dashboard?classId=swe-311-c1')

    const card = await screen.findByRole('region', { name: 'Summary ready' })
    expect(within(card).getByText(/Reviewed by/)).toBeVisible()
    expect(within(card).getByRole('link', { name: 'Read full summary' })).toHaveAttribute(
      'href',
      '/courses/swe-311/classes/swe-311-c1/summary',
    )

    await user.click(within(card).getByRole('button', { name: 'Ask about this' }))

    expect(await screen.findByRole('textbox', { name: 'Ask a question' })).toBeVisible()
    expect(router.state.location.search).toContain('mode=ask')
  })
})

describe('DashboardPage: Ask mode', () => {
  // Proves Ask is the same screen with the chat for the chosen class, labelled Preview in the
  // demo, and switching back returns to the notes.
  it('switches to the chat for the chosen class and back', async () => {
    const { user } = renderDashboard()
    await screen.findByRole('textbox', { name: 'Note' })

    await user.click(screen.getByRole('button', { name: 'Ask' }))

    expect(await screen.findByRole('textbox', { name: 'Ask a question' })).toBeVisible()
    expect(within(screen.getByRole('main')).getByText('Preview')).toBeVisible()
    expect(screen.getByRole('button', { name: /Class: SWE 311 · SDLC Models/ })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Note' }))
    expect(await screen.findByRole('textbox', { name: 'Note' })).toBeVisible()
  })

  // Proves a link can open Home on Ask.
  it('opens on Ask from the address', async () => {
    renderDashboard({}, '/dashboard?mode=ask')
    expect(await screen.findByRole('textbox', { name: 'Ask a question' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Ask' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('DashboardPage: states', () => {
  // Proves a student with no courses sees the enrolment message, not a composer (FR-DSH-6).
  it('explains when the student has no courses', async () => {
    renderDashboard(emptyCatalog())

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
    renderDashboard(hangingCatalog())

    await screen.findByRole('heading', { level: 1 }).catch(() => undefined)
    expect(screen.getAllByRole('status').some((el) => el.textContent.includes('Loading…'))).toBe(
      true,
    )
  })

  // Proves a failed load explains itself and offers a retry (section 11).
  it('shows an error with a retry when loading fails', async () => {
    renderDashboard(failingCatalog())

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't reach CoNote/)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    const { container } = renderDashboard()
    await screen.findByRole('textbox', { name: 'Note' })

    await expectNoAxeViolations(container)
  })
})
