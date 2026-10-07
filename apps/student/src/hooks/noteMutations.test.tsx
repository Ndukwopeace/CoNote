/**
 * Tests for the note read and write hooks: cache updates, optimistic edits and deletes, and
 * rollback when the service fails (REQUIREMENTS.md section 11).
 */

// Hook rendering and waiting helpers.
import { act, renderHook, waitFor } from '@testing-library/react'
// Type for the wrapper's children.
import type { ReactNode } from 'react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real providers.
import { AppProviders } from '@/app/AppProviders'
// The error type failures arrive as.
import { AppError } from '@conote/core/errors'
// Service types.
import type { NoteService, Services } from '@/services/types'
// Instant demo services and a no-retry cache.
import { createTestQueryClient, createTestServices } from '@/test/renderWithRouter'

// The hooks under test.
import { useCreateNote, useDeleteNote, useNote, useUpdateNote } from './useNoteMutations'
import { useMyNotes } from './useNotes'

/** Renders `hook` inside the providers, with the note service optionally changed. */
function renderNoteHook<T>(hook: () => T, notes: Partial<NoteService> = {}) {
  // Demo services, with the test's note overrides.
  const base = createTestServices()
  const services: Services = { ...base, notes: { ...base.notes, ...notes } }
  // One cache shared by every render of this hook.
  const queryClient = createTestQueryClient()
  // The wrapper.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders services={services} queryClient={queryClient}>
      {children}
    </AppProviders>
  )
  return { ...renderHook(hook, { wrapper }), queryClient }
}

/** A service call that fails as if offline. */
const offline = () => Promise.reject(new AppError('network', 'offline'))

/** A valid edit of note-7. */
const EDIT = { classId: 'swe-311-c4', title: 'Edited title', contentHtml: '<p>New</p>', tags: [] }

describe('useNote', () => {
  // Proves a single note is read, and a missing one is not_found.
  it('reads one note', async () => {
    // Act.
    const { result } = renderNoteHook(() => ({
      found: useNote('note-7'),
      missing: useNote('nope'),
    }))

    // Assert.
    await waitFor(() => {
      expect(result.current.found.data?.title).toBe('Waterfall in one line')
    })
    await waitFor(() => {
      expect(result.current.missing.error?.kind).toBe('not_found')
    })
  })
})

describe('useCreateNote', () => {
  // Proves a new note appears in the lists once saved.
  it('adds the new note to the cached lists', async () => {
    // Arrange.
    const { result } = renderNoteHook(() => ({ list: useMyNotes(), create: useCreateNote() }))
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(11)
    })

    // Act.
    await act(() =>
      result.current.create.mutateAsync({
        classId: 'swe-311-c4',
        title: 'New',
        contentHtml: '<p>x</p>',
        tags: [],
      }),
    )

    // Assert.
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(12)
    })
  })
})

describe('useUpdateNote', () => {
  // Proves the edit shows before the service answers.
  it('shows the edit straight away', async () => {
    // Arrange: a service that never answers, so only the optimistic change can show.
    const { result } = renderNoteHook(
      () => ({ note: useNote('note-7'), list: useMyNotes(), update: useUpdateNote() }),
      { updateNote: () => new Promise(() => undefined) },
    )
    await waitFor(() => {
      expect(result.current.note.data).toBeDefined()
      expect(result.current.list.data).toBeDefined()
    })

    // Act.
    act(() => {
      result.current.update.mutate({ noteId: 'note-7', input: EDIT })
    })

    // Assert: both the note and its row in the list changed.
    await waitFor(() => {
      expect(result.current.note.data?.title).toBe('Edited title')
    })
    expect(result.current.list.data?.find((n) => n.id === 'note-7')?.title).toBe('Edited title')
  })

  // Proves a failed edit puts the old version back.
  it('rolls back when saving fails', async () => {
    // Arrange.
    const { result } = renderNoteHook(
      () => ({ note: useNote('note-7'), update: useUpdateNote() }),
      {
        updateNote: offline,
      },
    )
    await waitFor(() => {
      expect(result.current.note.data).toBeDefined()
    })

    // Act.
    await act(async () => {
      await result.current.update
        .mutateAsync({ noteId: 'note-7', input: EDIT })
        .catch(() => undefined)
    })

    // Assert: the failure is reported and the old title is back.
    await waitFor(() => {
      expect(result.current.update.error?.kind).toBe('network')
    })
    expect(result.current.note.data?.title).toBe('Waterfall in one line')
  })
})

describe('useDeleteNote', () => {
  // Proves the note leaves the list straight away.
  it('removes the note straight away', async () => {
    // Arrange.
    const { result } = renderNoteHook(() => ({ list: useMyNotes(), remove: useDeleteNote() }), {
      deleteNote: () => new Promise(() => undefined),
    })
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(11)
    })

    // Act.
    act(() => {
      result.current.remove.mutate('note-7')
    })

    // Assert.
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(10)
    })
  })

  // Proves a failed delete brings the note back.
  it('rolls back when deleting fails', async () => {
    // Arrange.
    const { result } = renderNoteHook(() => ({ list: useMyNotes(), remove: useDeleteNote() }), {
      deleteNote: offline,
    })
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(11)
    })

    // Act.
    await act(async () => {
      await result.current.remove.mutateAsync('note-7').catch(() => undefined)
    })

    // Assert.
    expect(result.current.list.data).toHaveLength(11)
  })
})
