/**
 * Tests for the Notes page (FR-NTE-7, FR-NTE-8): My Notes with filter, search, sort and the row
 * menu, and the Summaries tab.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Service types.
import type { Services } from '@/services/types'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Empty, failing and hanging data.
import { emptyCatalog, failingCatalog, hangingCatalog } from '@/test/catalogServices'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** Renders the Notes page at `path`, signed in. */
function renderNotes(path = '/notes', services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

/** The note rows on screen (the list's own items, not the tag chips inside them). */
function rows() {
  return Array.from(screen.getByRole('list', { name: 'My notes' }).children) as HTMLElement[]
}

describe('NotesPage: My Notes', () => {
  // Proves every note is listed newest first, each row with its course, class, tags and actions.
  it('lists the notes with their details', async () => {
    // Act.
    renderNotes()

    // Assert.
    expect(await screen.findByRole('heading', { level: 1, name: 'Notes' })).toBeInTheDocument()
    await screen.findByRole('list', { name: 'My notes' })
    expect(rows()).toHaveLength(11)
    const [first] = rows()
    expect(first).toHaveTextContent('Waterfall in one line')
    expect(first).toHaveTextContent('SWE 311 · SDLC Models')
    expect(first).toHaveTextContent('Key concept')
    expect(within(first!).getByRole('link', { name: 'Waterfall in one line' })).toHaveAttribute(
      'href',
      '/notes/note-7',
    )
    expect(
      within(first!).getByRole('link', { name: 'Edit Waterfall in one line' }),
    ).toHaveAttribute('href', '/notes/note-7/edit')
    expect(screen.getByRole('link', { name: 'New note' })).toHaveAttribute('href', '/notes/new')
  })

  // Proves the course filter, search and sort, all kept in the address.
  it('filters, searches and sorts', async () => {
    // Arrange.
    const { user, router } = renderNotes()
    await screen.findByRole('list', { name: 'My notes' })

    // Act and assert: course.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Course' }), 'cse-205')
    expect(rows()).toHaveLength(2)
    expect(router.state.location.search).toBe('?course=cse-205')

    // Act and assert: sort.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'oldest')
    expect(rows()[0]).toHaveTextContent('AVL rotations')

    // Act and assert: search.
    await user.type(screen.getByRole('searchbox', { name: 'Search notes' }), 'linked list')
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Why balance?')
  })

  // Proves the row menu's Delete asks, then removes the note (FR-NTE-8).
  it('deletes from the row menu', async () => {
    // Arrange.
    const { user } = renderNotes()
    await screen.findByRole('list', { name: 'My notes' })

    // Act.
    await user.click(screen.getByRole('button', { name: 'More actions for Waterfall in one line' }))
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    )

    // Assert.
    await waitFor(() => {
      expect(rows()).toHaveLength(10)
    })
    expect(await screen.findByText('Note deleted.')).toBeInTheDocument()
  })

  // Proves an empty search says so and can be cleared.
  it('clears a search with no matches', async () => {
    // Arrange.
    const { user } = renderNotes('/notes?q=zzzz')

    // Act.
    await user.click(await screen.findByRole('button', { name: 'Clear search and filter' }))

    // Assert.
    expect(await screen.findByRole('list', { name: 'My notes' })).toBeInTheDocument()
    expect(rows()).toHaveLength(11)
  })

  // Proves a student with no notes is pointed to writing one.
  it('shows an empty state with no notes', async () => {
    // Act.
    renderNotes('/notes', emptyCatalog())

    // Assert.
    expect(await screen.findByText('No notes yet')).toBeInTheDocument()
  })

  // Proves loading and failure states (section 11).
  it('shows loading and error states', async () => {
    // Act: never finishes.
    const { unmount } = renderNotes('/notes', hangingCatalog())

    // Assert.
    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    unmount()

    // Act: fails.
    renderNotes('/notes', failingCatalog())

    // Assert.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderNotes()
    await screen.findByRole('list', { name: 'My notes' })

    // Assert.
    await expectNoAxeViolations(container)
  })
})

describe('NotesPage: Summaries', () => {
  // Proves the Summaries tab lists published summaries, linking to each (from ?tab=summaries).
  it('lists published summaries', async () => {
    // Act.
    renderNotes('/notes?tab=summaries')

    // Assert.
    expect(
      await screen.findByRole('tab', { name: 'Summaries', selected: true }),
    ).toBeInTheDocument()
    const panel = screen.getByRole('tabpanel')
    const links = await within(panel).findAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveTextContent('Software Requirements')
    expect(links[0]).toHaveAttribute('href', '/courses/swe-311/classes/swe-311-c2/summary')
  })
})
