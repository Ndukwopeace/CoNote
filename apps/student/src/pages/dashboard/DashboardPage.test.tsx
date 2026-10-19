/**
 * Tests for Home (D101, D102, D103): the "Let's CoNote" statement, the stream of the chosen
 * class's notes, the composer with the class chip and tags, the class sheet, the summary card, the
 * Ask mode, the navigation (drawer and sidebar), the dark frame without the portal's own bar, and
 * the no-courses, loading and error states (FR-DSH-6), over the demo data at a fixed time.
 */

// Queries.
import { screen, waitFor, within } from '@testing-library/react'
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

describe('DashboardPage: frame', () => {
  // Proves Home is its own screen, without the portal's search bar, and follows the student's
  // theme (light by default) instead of forcing dark.
  it('is light by default and has no portal search bar', async () => {
    renderDashboard()
    await screen.findByRole('textbox', { name: 'Note' })

    expect(document.documentElement).not.toHaveClass('dark')
    expect(screen.queryByRole('combobox', { name: /Search courses/ })).toBeNull()
  })

  // Proves the student's saved dark choice shows on Home and stays when they go to another page.
  it('follows a saved dark theme, here and on the next page', async () => {
    window.localStorage.setItem('conote:theme', 'dark')
    const { router } = renderDashboard()
    await screen.findByRole('textbox', { name: 'Note' })
    expect(document.documentElement).toHaveClass('dark')

    await router.navigate('/courses')
    await screen.findByRole('heading', { level: 1, name: 'My Courses' })
    expect(document.documentElement).toHaveClass('dark')
  })

  // Proves the top bar: the menu, the Note | Ask switch and the bell with its unread count.
  it('has the menu, the switch and the bell in the top bar', async () => {
    renderDashboard()
    await screen.findByRole('textbox', { name: 'Note' })

    expect(screen.getByRole('button', { name: 'Open menu' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Note' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('link', { name: /Notifications, \d+ unread/ })).toHaveAttribute(
      'href',
      '/notifications',
    )
  })
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

describe('DashboardPage: choosing the class', () => {
  /** A student whose classes have all yet to start. */
  function onlyFuture() {
    const base = createTestServices().classes
    return {
      classes: {
        ...base,
        listMyClasses: () =>
          Promise.resolve([makeClass({ id: 'later', courseId: 'swe-311', title: 'Later class' })]),
      },
    }
  }

  // Proves that with no class started the chip asks the student to choose, and the sheet offers
  // every class, including the ones still to come; choosing one files the notes under it.
  it('lets the student choose when no class has started', async () => {
    const { user } = renderDashboard(onlyFuture())
    const chip = await screen.findByRole('button', { name: 'Choose a class' })
    expect(screen.getByText('Choose a class below, then type a thought.')).toBeVisible()

    await user.click(chip)
    const sheet = await screen.findByRole('dialog', { name: 'Which class?' })
    await user.click(within(sheet).getByRole('button', { name: /Later class/ }))

    expect(await screen.findByRole('button', { name: /Class: .*Later class/ })).toBeVisible()
  })

  // Proves sending with no class opens the sheet instead of guessing, keeping the text.
  it('opens the class sheet when sending with no class', async () => {
    const { user } = renderDashboard(onlyFuture())
    await user.type(await screen.findByRole('textbox', { name: 'Note' }), 'Early thought{Enter}')

    expect(await screen.findByRole('dialog', { name: 'Which class?' })).toBeVisible()
    // The sheet hides the page from the accessibility tree while it is open.
    expect(screen.getByRole('textbox', { name: 'Note', hidden: true })).toHaveValue('Early thought')
  })

  // Proves the sheet lists the started classes first and then the ones to come, and choosing one
  // moves the chip.
  it('changes the class from the chip', async () => {
    const { user } = renderDashboard()
    await user.click(await screen.findByRole('button', { name: /Class: SWE 311 · SDLC Models/ }))

    const sheet = await screen.findByRole('dialog', { name: 'Which class?' })
    expect(within(sheet).getByText('On now')).toBeVisible()
    const names = within(sheet)
      .getAllByRole('button')
      .map((b) => b.textContent)
    // 12 classes in the demo, and the one on now comes first.
    expect(names.filter((n) => n.includes(' · '))).toHaveLength(12)
    await user.click(within(sheet).getByRole('button', { name: /Essay Structure/ }))

    expect(screen.queryByRole('dialog', { name: 'Which class?' })).toBeNull()
    expect(
      await screen.findByRole('button', { name: /Class: ENG 201 · Essay Structure/ }),
    ).toBeVisible()
  })
})

describe('DashboardPage: navigation', () => {
  // Proves the sidebar (wider screens) lists today's classes, earlier ones and the pages, with the
  // CoNote logo; choosing a class there moves the chip.
  it('lists the classes and pages, and choosing a class moves the chip', async () => {
    const { user } = renderDashboard()
    await screen.findByRole('textbox', { name: 'Note' })
    const nav = screen.getByRole('navigation', { name: 'Main' })

    expect(within(nav).getByText('Today')).toBeVisible()
    expect(within(nav).getByText('Earlier')).toBeVisible()
    expect(within(nav).getByRole('link', { name: /Summaries/ })).toHaveAttribute(
      'href',
      '/notes?tab=summaries',
    )
    for (const [name, href] of [
      ['All notes', '/notes'],
      ['Courses', '/courses'],
      ['Classes', '/classes'],
      ['Settings', '/settings'],
    ] as const) {
      expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href)
    }
    // The CoNote word beside the mark.
    expect(within(nav).getByText('CoNote')).toBeVisible()

    await user.click(within(nav).getByRole('button', { name: /ENG 201 · Essay Structure/ }))
    expect(
      await screen.findByRole('button', { name: /Class: ENG 201 · Essay Structure/ }),
    ).toBeVisible()
  })

  // Proves the phone menu opens the same navigation as a drawer, and choosing a class closes it.
  it('opens the drawer from the menu button and closes it on a choice', async () => {
    const { user } = renderDashboard()
    await screen.findByRole('textbox', { name: 'Note' })
    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    const drawer = await screen.findByRole('dialog', { name: 'Menu' })
    await user.click(within(drawer).getByRole('button', { name: /ENG 201 · Essay Structure/ }))

    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
    expect(
      await screen.findByRole('button', { name: /Class: ENG 201 · Essay Structure/ }),
    ).toBeVisible()
  })

  // Proves the student can sign out from Home, where the account menu is gone.
  it('signs out from the navigation', async () => {
    const { user, router } = renderDashboard()
    const nav = await screen.findByRole('navigation', { name: 'Main' })

    await user.click(within(nav).getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe('/dashboard')
    })
  })
})

describe('DashboardPage: Ask mode', () => {
  // Proves Ask is the same screen: the statement and suggested questions while empty, a question
  // sent from the composer shown as a bubble, then the answer.
  it('asks a question and shows the conversation', async () => {
    const { user } = renderDashboard()
    await screen.findByRole('textbox', { name: 'Note' })

    await user.click(screen.getByRole('button', { name: 'Ask' }))
    const box = await screen.findByRole('textbox', { name: 'Ask a question' })
    expect(within(screen.getByRole('main')).getByText('Preview')).toBeVisible()
    expect(screen.getByRole('button', { name: /Class: SWE 311 · SDLC Models/ })).toBeVisible()

    await user.type(box, 'What is waterfall?{Enter}')

    expect(await screen.findByText('What is waterfall?')).toBeVisible()
    // The answer arrives as the second bubble.
    await waitFor(() => {
      expect(within(screen.getByRole('log')).getAllByRole('listitem')).toHaveLength(2)
    })
    await user.click(screen.getByRole('button', { name: 'Note' }))
    expect(await screen.findByRole('textbox', { name: 'Note' })).toBeVisible()
  })

  // Proves a suggested question sends itself.
  it('sends a suggested question', async () => {
    const { user } = renderDashboard({}, '/dashboard?mode=ask')
    const suggestions = await screen.findAllByRole('button', { name: /\?$|summar|class/i })
    expect(suggestions.length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Ask' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(
      within(screen.getByRole('main'))
        .getAllByRole('listitem')[0]!
        .querySelector('button') as HTMLElement,
    )
    expect(await screen.findByRole('log', { name: 'Conversation' })).toBeVisible()
  })
})

describe('DashboardPage: states', () => {
  // Proves a student with no courses sees the enrolment message under the statement, not a
  // composer (FR-DSH-6).
  it('explains when the student has no courses', async () => {
    renderDashboard(emptyCatalog())

    expect(
      await screen.findByText(
        /You're not enrolled in any courses yet\. Join your programme to get your courses, or wait for your teacher or administrator to add you\./,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: "Let's CoNote" })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Join programme' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Note' })).toBeNull()
  })

  // Proves loading shows skeletons, not a blank page (section 11).
  it('shows skeletons while loading', async () => {
    renderDashboard(hangingCatalog())

    await waitFor(() => {
      expect(screen.getAllByRole('status').some((el) => el.textContent.includes('Loading…'))).toBe(
        true,
      )
    })
  })

  // Proves the frame is there while the data loads, so a student can always leave Home (offline,
  // for one): the menu, the switch, the bell and the navigation.
  it('keeps the menu and navigation while loading', async () => {
    renderDashboard(hangingCatalog())

    expect(await screen.findByRole('button', { name: 'Open menu' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Note' })).toBeVisible()
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Courses',
      }),
    ).toBeVisible()
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
