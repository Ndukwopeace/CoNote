/**
 * Tests for the note form on the New and Edit pages (FR-NTE-1 to FR-NTE-6, FR-NTE-9): class
 * choice, validation, saving, Cancel with unsaved changes, and draft restore.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// The unsaved-changes flag the update toast reads.
import { getHasUnsavedChanges } from '@/features/pwa/unsavedChanges'
// The error type.
import { AppError } from '@/lib/errors'
// Draft storage.
import { draftKey, saveDraft } from '@/lib/noteDrafts'
// Accessibility check.
import { expectNoAxeViolations } from '@/test/axe'
// Layout stand-ins the editor needs in jsdom.
import { installEditorDomStubs } from '@/test/editorDom'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper and demo services.
import { createTestServices, renderWithRouter } from '@/test/renderWithRouter'
// Service types.
import type { Services } from '@/services/types'

/** Renders the app at `path`, signed in. */
function renderAt(path: string, services: Partial<Services> = {}) {
  return renderWithRouter({ routes, path, session: makeSession(), services })
}

/** The note body editor. */
async function body() {
  return screen.findByRole('textbox', { name: 'Note' })
}

// The editor needs layout calls jsdom lacks.
installEditorDomStubs()

describe('NoteForm: new note', () => {
  // Proves a note opened from a class is filed under it, saved, and shown on the class (FR-NTE-6).
  it('saves a note for the class it was opened from', async () => {
    // Arrange.
    const { user, router } = renderAt('/notes/new?classId=swe-311-c4')
    expect(await screen.findByText('SWE 311 · SDLC Models')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Course' })).toBeNull()

    // Act: title, body, a tag, save.
    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'Spiral model')
    await user.click(await body())
    await user.keyboard('Risk-driven iterations')
    await user.click(screen.getByRole('button', { name: 'Question' }))
    await user.click(screen.getByRole('button', { name: 'Save Note' }))

    // Assert: toast, then the class page's Notes tab with the new note.
    expect(await screen.findByText('Note saved.')).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname + router.state.location.search).toBe(
        '/courses/swe-311/classes/swe-311-c4?tab=notes',
      )
    })
    expect(await screen.findByRole('link', { name: /Spiral model/ })).toBeInTheDocument()
  })

  // Proves the course → class picker when no class was given, and the FR-NTE-1/4 checks.
  it('asks for a class and a body', async () => {
    // Arrange.
    const { user } = renderAt('/notes/new')
    await body()

    // Act: save straight away.
    await user.click(screen.getByRole('button', { name: 'Save Note' }))

    // Assert: both problems are reported.
    expect(await screen.findByText('Choose the class this note is for.')).toBeInTheDocument()
    expect(screen.getByText('Write something in your note.')).toBeInTheDocument()

    // Act: pick a course, then one of its classes.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Course' }), 'eng-201')
    const classSelect = screen.getByRole('combobox', { name: 'Class' })
    expect(
      within(classSelect)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'Choose a class',
      '1. Essay Structure',
      '2. Citing Sources',
      '3. Argument and Evidence',
    ])
    await user.selectOptions(classSelect, 'eng-201-c2')

    // Assert: the class error has gone.
    await waitFor(() => {
      expect(screen.queryByText('Choose the class this note is for.')).toBeNull()
    })
  })

  // SECURITY: proves a class ID from the address that isn't one of the student's is ignored.
  it('ignores an unknown class in the address', async () => {
    // Act.
    renderAt('/notes/new?classId=someone-elses-class')

    // Assert: the picker shows, with nothing chosen.
    expect(await screen.findByRole('combobox', { name: 'Course' })).toHaveValue('')
  })

  // Proves a service refusal is shown above the form, in its own words.
  it('shows the reason when saving is refused', async () => {
    // Arrange: a note service that refuses every save.
    const base = createTestServices()
    const { user } = renderAt('/notes/new?classId=swe-311-c4', {
      notes: {
        ...base.notes,
        createNote: () =>
          Promise.reject(new AppError('validation', 'Notes can be up to 20,000 characters.')),
      },
    })
    await user.click(await body())
    await user.keyboard('Text')

    // Act.
    await user.click(screen.getByRole('button', { name: 'Save Note' }))

    // Assert.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Notes can be up to 20,000 characters.',
    )
  })
})

describe('NoteForm: edit', () => {
  // Proves the note's values load, the published notice shows (FR-NTE-9), and the edit saves.
  it('edits a note on a class with a published summary', async () => {
    // Arrange.
    const { user, router } = renderAt('/notes/note-1/edit')
    const title = await screen.findByRole('textbox', { name: /Title/ })
    expect(title).toHaveValue('Why process matters')
    expect(await body()).toHaveTextContent('Without an agreed process')
    expect(screen.getByRole('button', { name: 'Key concept' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText(/summary for this class is already published/)).toBeInTheDocument()

    // Act.
    await user.clear(title)
    await user.type(title, 'Process first')
    await user.click(screen.getByRole('button', { name: 'Save Note' }))

    // Assert: back on the class's Notes tab with the new title.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/courses/swe-311/classes/swe-311-c1')
    })
    expect(await screen.findByRole('link', { name: /Process first/ })).toBeInTheDocument()
  })

  // Proves an unknown note shows the not-found panel.
  it('shows not found for an unknown note', async () => {
    // Act.
    renderAt('/notes/no-such-note/edit')

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Note not found' }),
    ).toBeInTheDocument()
  })
})

describe('NoteForm: unsaved changes', () => {
  // Proves Cancel with changes asks first (FR-NTE-5), and "Keep editing" stays.
  it('asks before discarding changes', async () => {
    // Arrange.
    const { user, router } = renderAt('/notes/note-1/edit')
    const title = await screen.findByRole('textbox', { name: /Title/ })
    await user.type(title, ' (draft)')

    // Act: Cancel, then keep editing.
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))

    // Assert: still editing.
    expect(router.state.location.pathname).toBe('/notes/note-1/edit')

    // Act: Cancel, then discard.
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))

    // Assert: left the editor, and the draft is gone.
    await waitFor(() => {
      expect(router.state.location.pathname).not.toBe('/notes/note-1/edit')
    })
    expect(window.localStorage.getItem(draftKey({ noteId: 'note-1' }))).toBeNull()
  })

  // Proves Cancel without changes leaves at once.
  it('cancels without asking when nothing changed', async () => {
    // Arrange.
    const { user, router } = renderAt('/notes/note-1/edit')
    await screen.findByRole('textbox', { name: /Title/ })

    // Act.
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Assert.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/notes/note-1')
    })
  })

  // Proves the update toast is held back while there are unsaved changes (FR-PWA-5).
  it('sets the unsaved-changes flag while editing', async () => {
    // Arrange.
    const { user, unmount } = renderAt('/notes/note-1/edit')
    const title = await screen.findByRole('textbox', { name: /Title/ })
    expect(getHasUnsavedChanges()).toBe(false)

    // Act: change the title.
    await user.type(title, 'x')

    // Assert: set while editing, cleared when the form closes.
    await waitFor(() => {
      expect(getHasUnsavedChanges()).toBe(true)
    })
    unmount()
    expect(getHasUnsavedChanges()).toBe(false)
  })
})

describe('NoteForm: drafts', () => {
  // Proves typing is saved as a draft, which the next visit offers to restore (FR-NTE-5).
  it('offers to restore a saved draft', async () => {
    // Arrange: a draft from earlier.
    saveDraft(
      window.localStorage,
      draftKey({ classId: 'swe-311-c4' }),
      {
        classId: 'swe-311-c4',
        title: 'From the draft',
        contentHtml: '<p>Draft body</p>',
        tags: ['Example'],
      },
      new Date(),
    )
    const { user } = renderAt('/notes/new?classId=swe-311-c4')

    // Assert: the banner.
    expect(await screen.findByText(/You have an unsaved draft from just now/i)).toBeInTheDocument()

    // Act.
    await user.click(screen.getByRole('button', { name: 'Restore' }))

    // Assert: the draft is in the form.
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveValue('From the draft')
    expect(await body()).toHaveTextContent('Draft body')
    expect(screen.getByRole('button', { name: 'Example' })).toHaveAttribute('aria-pressed', 'true')
  })

  // Proves Discard deletes the draft and keeps the form as it was.
  it('discards a saved draft', async () => {
    // Arrange.
    const key = draftKey({ noteId: 'note-1' })
    saveDraft(
      window.localStorage,
      key,
      { classId: 'swe-311-c1', title: 'Old draft', contentHtml: '<p>x</p>', tags: [] },
      new Date(),
    )
    const { user } = renderAt('/notes/note-1/edit')

    // Act.
    await user.click(await screen.findByRole('button', { name: 'Discard' }))

    // Assert.
    expect(screen.queryByText(/unsaved draft/)).toBeNull()
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveValue('Why process matters')
    expect(window.localStorage.getItem(key)).toBeNull()
  })

  // Proves changes are written to a draft as the student types.
  it('saves a draft while typing', async () => {
    // Arrange.
    const { user } = renderAt('/notes/new?classId=swe-311-c4')

    // Act.
    await user.type(await screen.findByRole('textbox', { name: /Title/ }), 'Autosaved')

    // Assert: stored within a couple of seconds.
    await waitFor(
      () => {
        expect(window.localStorage.getItem(draftKey({ classId: 'swe-311-c4' }))).toContain(
          'Autosaved',
        )
      },
      { timeout: 3000 },
    )
  })

  // Proves the form passes the automated accessibility rules.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderAt('/notes/new')
    await screen.findByRole('combobox', { name: 'Course' })

    // Assert.
    await expectNoAxeViolations(container)
  })
})
