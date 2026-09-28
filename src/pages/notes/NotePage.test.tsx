/**
 * Tests for the note read view at /notes/:noteId (FR-NTE-8, FR-NTE-10).
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// The error type.
import { AppError } from '@/lib/errors'
// Service types.
import type { Services } from '@/services/types'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Failing and hanging data.
import { failingCatalog, hangingCatalog } from '@/test/catalogServices'
// Factories.
import { makeNote, makeSession } from '@/test/factories'
// Render helper and demo services.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'

/** Renders the app at `path`, signed in. */
function renderAt(path: string, services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

describe('NotePage', () => {
  // Proves FR-NTE-10: title, body, tags, class link and times.
  it('shows the note with its tags, class and times', async () => {
    // Act.
    renderAt('/notes/note-4')

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Is "fast" a requirement?' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Only if it is measurable/)).toBeInTheDocument()
    const tags = screen.getByRole('list', { name: 'Tags' })
    expect(
      within(tags)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Question', 'Aha moment'])
    expect(screen.getByRole('link', { name: /Software Requirements/ })).toHaveAttribute(
      'href',
      '/courses/swe-311/classes/swe-311-c2',
    )
    expect(screen.getByText(/Created/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/notes/note-4/edit')
  })

  // SECURITY: proves the body is sanitised on display, even if stored HTML were hostile.
  it('strips scripts and event handlers from the body', async () => {
    // Arrange: a note service returning hostile HTML.
    const base = createTestServices()
    const hostile = makeNote({
      id: 'note-x',
      courseId: 'swe-311',
      classId: 'swe-311-c1',
      title: 'Hostile',
      contentHtml: '<p>Safe text</p><img src=x onerror="alert(1)"><script>alert(2)</script>',
    })
    const { container } = renderAt('/notes/note-x', {
      notes: { ...base.notes, getNote: () => Promise.resolve(hostile) },
    })

    // Assert.
    expect(await screen.findByText('Safe text')).toBeInTheDocument()
    expect(container.querySelector('script, img, [onerror]')).toBeNull()
  })

  // Proves delete asks first, then removes the note and returns to Notes (FR-NTE-8).
  it('deletes after confirmation', async () => {
    // Arrange.
    const { user, router } = renderAt('/notes/note-4')
    await screen.findByRole('heading', { level: 1 })

    // Act.
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this note?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    // Assert.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/notes')
    })
    expect(await screen.findByText('Note deleted.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Is "fast" a requirement?' })).toBeNull()
  })

  // Proves a failed delete is reported and the note comes back.
  it('reports a failed delete', async () => {
    // Arrange.
    const base = createTestServices()
    const { user } = renderAt('/notes/note-4', {
      notes: {
        ...base.notes,
        deleteNote: () => Promise.reject(new AppError('network', 'offline')),
      },
    })
    await screen.findByRole('heading', { level: 1 })

    // Act.
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    )

    // Assert: the error toast, and the note is back in the list.
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't delete the note.")
    expect(
      await screen.findByRole('link', { name: 'Is "fast" a requirement?' }),
    ).toBeInTheDocument()
  })

  // Proves an unknown note shows the not-found panel.
  it('shows not found for an unknown note', async () => {
    // Act.
    renderAt('/notes/no-such-note')

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Note not found' }),
    ).toBeInTheDocument()
  })

  // Proves loading and failure states (section 11).
  it('shows loading and error states', async () => {
    // Act: never finishes.
    const { unmount } = renderAt('/notes/note-4', hangingCatalog())

    // Assert.
    expect(await screen.findByText('Loading…')).toBeInTheDocument()
    unmount()

    // Act: fails.
    renderAt('/notes/note-4', failingCatalog())

    // Assert.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Proves the page passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderAt('/notes/note-4')
    await screen.findByRole('list', { name: 'Tags' })

    // Assert.
    await expectNoAxeViolations(container)
  })
})
