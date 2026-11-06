/**
 * Tests for the screen both staff portals use to read students' notes (D123): the counts above a
 * class, who has not written, the notes with their authors, the student search and the paging.
 */

// Queries.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Rendering, and finding things by what a person sees.
import { render, screen, waitFor, within } from '@testing-library/react'
// Realistic typing and clicking.
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// The shapes the screen reads.
import type {
  NoteEntry,
  NotePage,
  NoteReadingService,
  NoteRosterEntry,
  NoteSearchQuery,
} from '@conote/core/noteReading'

import { NotesExplorer } from './NotesExplorer'

/** One note, with the fields a test cares about overridden. */
function note(overrides: Partial<NoteEntry> & { id: string }): NoteEntry {
  return {
    classId: 'k1',
    classNumber: 3,
    classTitle: 'Eigenvalues',
    courseId: 'c1',
    courseCode: 'MTH 202',
    courseTitle: 'Linear Algebra',
    studentId: 's1',
    studentName: 'Ada Student',
    studentNumber: 'U2026/0001',
    title: null,
    contentHtml: '<p>text</p>',
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
    ...overrides,
  }
}

const ROSTER: NoteRosterEntry[] = [
  { studentId: 's1', studentName: 'Ada Student', studentNumber: 'U2026/0001', noteCount: 3 },
  { studentId: 's2', studentName: 'Bo Learner', studentNumber: null, noteCount: 1 },
  { studentId: 's3', studentName: 'Cy Quiet', studentNumber: 'U2026/0003', noteCount: 0 },
]

/** A service whose answers the test sets; the calls are kept to check what was asked. */
function service(overrides: Partial<NoteReadingService> = {}) {
  const searchNotes = vi.fn<(query: NoteSearchQuery) => Promise<NotePage>>(() =>
    Promise.resolve({
      notes: [
        note({
          id: 'n1',
          studentName: 'Ada Student',
          title: 'Mine',
          contentHtml: '<p>Eigen <b>values</b></p>',
        }),
        note({ id: 'n2', studentId: 's2', studentName: 'Bo Learner', studentNumber: null }),
      ],
      total: 2,
    }),
  )
  const getNoteRoster = vi.fn<(classId: string) => Promise<NoteRosterEntry[]>>(() =>
    Promise.resolve(ROSTER),
  )
  return { searchNotes, getNoteRoster, ...overrides } satisfies NoteReadingService
}

/** Renders the explorer over `notes`, with a cache that never retries so failures show at once. */
function renderExplorer(
  notes: NoteReadingService,
  props: Partial<React.ComponentProps<typeof NotesExplorer>> = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NotesExplorer service={notes} classId="k1" {...props} />
    </QueryClientProvider>,
  )
  return { ...view, user: userEvent.setup() }
}

describe('NotesExplorer', () => {
  // Proves the line above a class: how many notes, from how many of the enrolled students.
  it('says how many notes came from how many students', async () => {
    renderExplorer(service())

    expect(await screen.findByText('4 notes from 2 of 3 students')).toBeVisible()
  })

  // Proves the teacher sees who has not written yet, by name.
  it('lists the students who have not written', async () => {
    const { user } = renderExplorer(service())

    await user.click(await screen.findByText('Not written yet (1)'))

    expect(screen.getByText(/Cy Quiet/)).toBeVisible()
    expect(screen.getByText(/U2026\/0003/)).toBeVisible()
  })

  // Proves each note shows its author and its text as plain words, with no markup.
  it('shows each note with its author, as text', async () => {
    renderExplorer(service())

    const first = (await screen.findAllByRole('listitem')).find((item) =>
      within(item).queryByText('Mine'),
    )
    expect(first).toBeDefined()
    expect(within(first ?? document.body).getByText('Ada Student')).toBeVisible()
    expect(within(first ?? document.body).getByText(/U2026\/0001/)).toBeVisible()
    expect(within(first ?? document.body).getByText('Eigen values')).toBeVisible()
    expect(document.querySelector('b')).toBeNull()
  })

  // SECURITY: proves markup a student typed is shown as words and never runs or links anywhere.
  it('shows typed markup as text', async () => {
    const hostile = service({
      searchNotes: vi.fn(() =>
        Promise.resolve({
          notes: [
            note({
              id: 'x',
              contentHtml: '<p>Hi</p><script>window.hacked=1</script><a href="javascript:x">go</a>',
            }),
          ],
          total: 1,
        }),
      ),
    })
    renderExplorer(hostile)

    expect(await screen.findByText(/Hi/)).toBeVisible()
    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('a')).toBeNull()
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined()
  })

  // Proves the student search asks for matching notes from the first page, and can be cleared.
  it('searches by student and clears the search', async () => {
    const notes = service()
    const { user } = renderExplorer(notes)
    await screen.findByText('4 notes from 2 of 3 students')

    await user.type(screen.getByRole('searchbox', { name: 'Search by student' }), 'bo')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(notes.searchNotes).toHaveBeenLastCalledWith(
        expect.objectContaining({ classId: 'k1', studentText: 'bo', offset: 0 }),
      )
    })
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await waitFor(() => {
      expect(notes.searchNotes).toHaveBeenLastCalledWith(
        expect.objectContaining({ studentText: undefined }),
      )
    })
  })

  // Proves paging: "Showing 1 to 20 of 45", Next asks for the next twenty, Previous is off at the start.
  it('pages through many notes', async () => {
    const many = service({
      searchNotes: vi.fn((query: NoteSearchQuery) =>
        Promise.resolve({
          notes: [note({ id: `n${String(query.offset ?? 0)}` })],
          total: 45,
        }),
      ),
    })
    const { user } = renderExplorer(many)

    expect(await screen.findByText('Showing 1 to 20 of 45')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(await screen.findByText('Showing 21 to 40 of 45')).toBeVisible()
    expect(many.searchNotes).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 }))
  })

  // Proves the course and class are named on each note when notes from many classes are listed.
  it('names the class on each note when asked to', async () => {
    renderExplorer(service(), { classId: undefined, showWhere: true })

    expect(await screen.findAllByText('MTH 202 · Class 3: Eigenvalues')).toHaveLength(2)
  })

  // Proves an empty class says it has no notes yet, and a search with no result says nothing matched.
  it('explains an empty result', async () => {
    const empty = service({
      searchNotes: vi.fn(() => Promise.resolve({ notes: [], total: 0 })),
    })
    const { user } = renderExplorer(empty)

    expect(await screen.findByText('No notes yet.')).toBeVisible()

    await user.type(screen.getByRole('searchbox', { name: 'Search by student' }), 'zed')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('No notes match.')).toBeVisible()
  })

  // Proves a failed load says what failed and offers another try.
  it('says when the notes could not be loaded, and tries again', async () => {
    const failing = service({
      searchNotes: vi
        .fn<(query: NoteSearchQuery) => Promise<NotePage>>()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValue({ notes: [note({ id: 'n1' })], total: 1 }),
    })
    const { user } = renderExplorer(failing)

    expect(await screen.findByText('Unable to load notes.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Ada Student')).toBeVisible()
  })

  // Proves the screen passes the accessibility check.
  it('has no accessibility violations', async () => {
    const { container } = renderExplorer(service())
    await screen.findByText('4 notes from 2 of 3 students')

    await expectNoAxeViolations(container)
  })
})
