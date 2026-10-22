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

  // Proves the "+" menu: a title on request, no second editor to leave for (D109), and the photo
  // option shown as not ready.
  it('offers a title from the plus menu, and no separate editor', async () => {
    const { user } = renderDashboard()
    await user.click(await screen.findByRole('button', { name: 'More options' }))

    expect(screen.queryByRole('menuitem', { name: 'Open the full editor' })).toBeNull()
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
  /** A class on the faked day (Monday 28 September 2026) from `hour` for two hours. */
  const onDay = (dayOffset: number, id: string, title: string, hour: number) =>
    makeClass({
      id,
      courseId: 'swe-311',
      title,
      startsAt: new Date(2026, 8, 28 + dayOffset, hour, 0).toISOString(),
      endsAt: new Date(2026, 8, 28 + dayOffset, hour + 2, 0).toISOString(),
    })

  /** A student whose classes are exactly `sessions`. */
  function withClasses(...sessions: ReturnType<typeof onDay>[]) {
    return {
      classes: { ...createTestServices().classes, listMyClasses: () => Promise.resolve(sessions) },
    }
  }

  // Proves a class that begins later today is listed but cannot be chosen yet (D108): the row is
  // disabled and says when it opens.
  it('lists a class that has not started but does not let it be chosen', async () => {
    const { user } = renderDashboard(withClasses(onDay(0, 'later', 'Later class', 10)))
    const chip = await screen.findByRole('button', { name: 'Choose a class' })
    expect(screen.getByText('Choose a class below, then type a thought.')).toBeVisible()

    await user.click(chip)
    const sheet = await screen.findByRole('dialog', { name: 'Which class?' })
    const row = within(sheet).getByRole('button', { name: /Later class/ })

    expect(row).toBeDisabled()
    expect(within(row).getByText(/Opens at 10 AM – 12 PM/)).toBeVisible()
  })

  // Proves tomorrow's class and one three days back are not listed at all (D108); with nothing
  // from the last three days the sheet says so.
  it('leaves out later days and classes older than two days', async () => {
    const { user } = renderDashboard(
      withClasses(onDay(1, 'next', 'Next class', 9), onDay(-3, 'old', 'Old class', 9)),
    )
    await user.click(await screen.findByRole('button', { name: 'Choose a class' }))
    const sheet = await screen.findByRole('dialog', { name: 'Which class?' })

    expect(within(sheet).getByText('You have no classes from the last three days.')).toBeVisible()
    expect(within(sheet).queryByRole('button', { name: /Next class/ })).toBeNull()
    expect(within(sheet).queryByRole('button', { name: /Old class/ })).toBeNull()
  })

  // Proves a class from yesterday can still be chosen from the sheet, and choosing it moves the chip.
  it('lets the student choose a class from yesterday', async () => {
    const { user } = renderDashboard(recentServices())
    await user.click(await screen.findByRole('button', { name: /Class: SWE 311 · First class/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Which class?' })

    await user.click(within(sheet).getByRole('button', { name: /Yesterday class/ }))

    expect(await screen.findByRole('button', { name: /Class: .*Yesterday class/ })).toBeVisible()
  })

  // Proves the sheet groups the classes by day: Today, Yesterday, then the date (D108).
  it('groups the classes under Today, Yesterday and the date', async () => {
    const { user } = renderDashboard(recentServices())
    await user.click(await screen.findByRole('button', { name: /Class: SWE 311 · First class/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Which class?' })

    const headings = within(sheet)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(headings).toEqual(['Today', 'Yesterday', 'Sat 26 Sep'])
    expect(within(sheet).getByRole('region', { name: 'Yesterday' })).toHaveTextContent(
      'Yesterday class',
    )
    expect(within(sheet).queryByRole('button', { name: /Old class/ })).toBeNull()
  })

  // Proves sending with no class opens the sheet instead of guessing, keeping the text.
  it('opens the class sheet when sending with no class', async () => {
    const { user } = renderDashboard(withClasses(onDay(0, 'later', 'Later class', 10)))
    await user.type(await screen.findByRole('textbox', { name: 'Note' }), 'Early thought{Enter}')

    expect(await screen.findByRole('dialog', { name: 'Which class?' })).toBeVisible()
    // The sheet hides the page from the accessibility tree while it is open.
    expect(screen.getByRole('textbox', { name: 'Note', hidden: true })).toHaveValue('Early thought')
  })

  // Proves the demo's classes older than two days are not offered, while the one on now is.
  it('does not offer the demo classes older than two days', async () => {
    const { user } = renderDashboard()
    await user.click(await screen.findByRole('button', { name: /Class: SWE 311 · SDLC Models/ }))

    const sheet = await screen.findByRole('dialog', { name: 'Which class?' })
    expect(within(sheet).getByText('On now')).toBeVisible()
    expect(within(sheet).queryByRole('button', { name: /Introduction to Software/ })).toBeNull()
    expect(within(sheet).queryByRole('button', { name: /Essay Structure/ })).toBeNull()
  })
})

/** A student with classes yesterday and the day before, one at 7 today, one at 10 today (not started at 9) and an old one. */
function recentServices() {
  /** A class on the faked day plus `dayOffset` days, from `hour` for an hour. */
  const on = (dayOffset: number, id: string, title: string, hour: number) =>
    makeClass({
      id,
      courseId: 'swe-311',
      title,
      startsAt: new Date(2026, 8, 28 + dayOffset, hour, 0).toISOString(),
      endsAt: new Date(2026, 8, 28 + dayOffset, hour + 1, 0).toISOString(),
    })
  return {
    classes: {
      ...createTestServices().classes,
      listMyClasses: () =>
        Promise.resolve([
          on(-1, 'yesterday', 'Yesterday class', 14),
          on(-2, 'before', 'Earlier class', 9),
          on(0, 'first', 'First class', 7),
          on(0, 'evening', 'Evening class', 10),
          on(-3, 'old', 'Old class', 9),
        ]),
    },
  }
}

describe('DashboardPage: navigation', () => {
  // Proves the sidebar (wider screens) lists the classes by day (Today, Yesterday, the date) and the
  // pages, with the CoNote logo; choosing a class there moves the chip, and a class that has not
  // started is shown but cannot be chosen (D108).
  it('lists the recent classes by day, and choosing a class moves the chip', async () => {
    const { user } = renderDashboard(recentServices())
    await screen.findByRole('textbox', { name: 'Note' })
    const nav = screen.getByRole('navigation', { name: 'Main' })

    expect(within(nav).getByText('Today')).toBeVisible()
    expect(within(nav).getByText('Yesterday')).toBeVisible()
    expect(within(nav).getByText('Sat 26 Sep')).toBeVisible()
    expect(within(nav).queryByRole('button', { name: /Old class/ })).toBeNull()
    expect(within(nav).getByRole('button', { name: /Evening class/ })).toBeDisabled()
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

    await user.click(within(nav).getByRole('button', { name: /Yesterday class/ }))
    expect(
      await screen.findByRole('button', { name: /Class: SWE 311 · Yesterday class/ }),
    ).toBeVisible()
  })

  // Proves the phone menu opens the same navigation as a drawer, and choosing a class closes it.
  it('opens the drawer from the menu button and closes it on a choice', async () => {
    const { user } = renderDashboard(recentServices())
    await screen.findByRole('textbox', { name: 'Note' })
    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    const drawer = await screen.findByRole('dialog', { name: 'Menu' })
    await user.click(within(drawer).getByRole('button', { name: /Yesterday class/ }))

    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
    expect(
      await screen.findByRole('button', { name: /Class: SWE 311 · Yesterday class/ }),
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

describe('DashboardPage: writing and editing in the chat', () => {
  // Proves every "New note" button lands on Home with the cursor in the box (D109).
  it('puts the cursor in the composer when opened to write', async () => {
    renderDashboard({}, '/dashboard?write=1&classId=swe-311-c4')

    const box = await screen.findByRole('textbox', { name: 'Note' })

    await waitFor(() => {
      expect(box).toHaveFocus()
    })
  })

  // Proves Home does not steal focus on an ordinary visit, which would open the keyboard on a
  // phone before the student has asked to write.
  it('leaves the composer alone on an ordinary visit', async () => {
    renderDashboard()

    const box = await screen.findByRole('textbox', { name: 'Note' })

    expect(box).not.toHaveFocus()
  })

  // Proves unsent text survives leaving Home and coming back (FR-NTE-5).
  it('keeps what was typed, and brings it back on the next visit', async () => {
    const first = renderDashboard()
    await first.user.type(await screen.findByRole('textbox', { name: 'Note' }), 'Half a thou')
    first.unmount()

    renderDashboard()

    expect(await screen.findByRole('textbox', { name: 'Note' })).toHaveValue('Half a thou')
  })

  // Proves a sent note leaves no draft behind to come back.
  it('does not bring back a note that was sent', async () => {
    const first = renderDashboard()
    await first.user.type(
      await screen.findByRole('textbox', { name: 'Note' }),
      'Sent already{Enter}',
    )
    await screen.findByText('Sent already')
    first.unmount()

    renderDashboard()

    expect(await screen.findByRole('textbox', { name: 'Note' })).toHaveValue('')
  })

  // Proves each bubble has an Edit link that opens that note in the composer (D109).
  it('opens a note for editing from its bubble', async () => {
    const { user, router } = renderDashboard()
    const bubble = (await screen.findByText(/Each phase finishes/)).closest('li') as HTMLElement

    await user.click(within(bubble).getByRole('link', { name: /^Edit/ }))

    expect(router.state.location.search).toBe('?edit=note-7')
    expect(await screen.findByRole('textbox', { name: 'Note' })).toHaveValue(
      'Each phase finishes before the next starts; changes late are expensive.',
    )
  })

  // Proves editing happens here: the note's text and tag are in the composer, a bar says which
  // note is being edited, and saving replaces the bubble and returns to a fresh composer.
  it('edits a note in the composer and saves it', async () => {
    const { user, router } = renderDashboard({}, '/dashboard?edit=note-7')
    const box = await screen.findByRole('textbox', { name: 'Note' })

    expect(await screen.findByText('Editing a note')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Key concept' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.type(box, ' Cost of change grows.{Enter}')

    expect(await screen.findByText(/Cost of change grows\./)).toBeVisible()
    await waitFor(() => {
      expect(router.state.location.search).toBe('')
    })
    expect(screen.queryByText('Editing a note')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('')
    // The same note was changed: it is not a second one.
    expect(screen.getAllByText(/Each phase finishes/)).toHaveLength(1)
  })

  // Proves Cancel leaves the note as it was and returns to writing a new one.
  it('cancels an edit without changing the note', async () => {
    const { user, router } = renderDashboard({}, '/dashboard?edit=note-7')
    const box = await screen.findByRole('textbox', { name: 'Note' })
    await user.type(box, ' something I will not keep')

    await user.click(screen.getByRole('button', { name: 'Cancel edit' }))

    await waitFor(() => {
      expect(router.state.location.search).toBe('')
    })
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('')
    expect(screen.queryByText(/I will not keep/)).toBeNull()
    expect(screen.getByText(/Each phase finishes before the next starts/)).toBeVisible()
  })

  // Proves the class cannot be changed while a note is edited, so it cannot be moved by accident.
  it('keeps the note in its own class while editing', async () => {
    renderDashboard({}, '/dashboard?edit=note-7')

    expect(await screen.findByText('Editing a note')).toBeVisible()

    expect(screen.getByRole('button', { name: /Class: SWE 311 · SDLC Models/ })).toBeDisabled()
  })

  // Proves a note from the old editor, with bold and lists, is flagged before the student edits:
  // the composer keeps the words but not the formatting.
  it('warns that formatting is removed when a rich note is edited', async () => {
    const services = createTestServices()
    const note = await services.notes.createNote({
      classId: 'swe-311-c4',
      title: '',
      contentHtml: '<p><strong>Bold</strong> idea</p><ul><li>One</li></ul>',
      tags: [],
    })
    renderDashboard({ notes: services.notes }, `/dashboard?edit=${note.id}`)

    expect(await screen.findByRole('textbox', { name: 'Note' })).toHaveValue('Bold idea\nOne')
    expect(screen.getByText(/Bold and lists are removed/)).toBeVisible()
  })

  // Proves an edit address for a note that is not the student's opens ordinary Home, not an error.
  it('ignores an edit address for an unknown note', async () => {
    renderDashboard({}, '/dashboard?edit=someone-elses-note')

    expect(await screen.findByRole('textbox', { name: 'Note' })).toHaveValue('')
    expect(screen.queryByText('Editing a note')).toBeNull()
  })

  // Proves an edit that fails is explained and keeps the typed text.
  it('keeps the text and explains when an edit fails', async () => {
    const base = createTestServices().notes
    const { user } = renderDashboard(
      { notes: { ...base, updateNote: () => Promise.reject(new AppError('network', 'offline')) } },
      '/dashboard?edit=note-7',
    )
    const box = await screen.findByRole('textbox', { name: 'Note' })

    await user.type(box, ' more{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't reach CoNote/)
    expect(box).toHaveValue(
      'Each phase finishes before the next starts; changes late are expensive. more',
    )
    expect(screen.getByText('Editing a note')).toBeVisible()
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
