/**
 * Tests for the review screen (teacher REQUIREMENTS section 9): reading, editing, saving,
 * publishing, conflicts, the unsaved-changes question, and the read-only and not-found cases.
 */

// Queries and waiting.
import { screen, waitFor, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'
// Session factory and the shared test platform.
import { makeSession } from '@/test/factories'
import { reviewPlatform } from '@/test/reviewPlatform'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// The shape read back.
import type { SummaryDraft } from '@/types/review'

/** Renders the review screen for `summaryId` over `platform`, signed in as the test teacher. */
function renderReview(platform = reviewPlatform(), summaryId = 's1') {
  return renderWithRouter({
    routes,
    path: `/teacher/reviews/${summaryId}`,
    session: makeSession('teacher'),
    platform,
  })
}

/** Waits for the editor to show. */
async function overview() {
  return screen.findByRole('textbox', { name: 'Overview' })
}

/** The draft the summary holds right now, read through the service. */
async function stored(services: ReturnType<typeof renderReview>['services']) {
  return services.review.getDraft('s1')
}

describe('ReviewPage', () => {
  // Proves the header and the draft show, with counts only: nothing of the notes themselves.
  it('shows the draft with the counts behind it', async () => {
    renderReview()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Class 4: Basis and dimension' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ready for your review')).toBeInTheDocument()
    expect(screen.getByText('Based on 18 notes from 14 students')).toBeInTheDocument()
    expect(await overview()).toHaveValue('The AI overview.')
    expect(screen.getByRole('textbox', { name: 'Concept 1 title' })).toHaveValue('Basis')
    expect(screen.getByRole('textbox', { name: 'Confusion 1 point' })).toHaveValue(
      'Span versus basis',
    )
    expect(screen.getByRole('textbox', { name: 'Topic 1 name' })).toHaveValue('Dimension')
    // The way back is the course.
    expect(screen.getByRole('link', { name: 'MTH 202 Linear Algebra' })).toHaveAttribute(
      'href',
      '/teacher/courses/mth-202',
    )
  })

  // Proves saving keeps the edit, confirms it, and leaves the summary in review.
  it('saves an edit and keeps the stage', async () => {
    const { user, services } = renderReview()
    const box = await overview()

    await user.clear(box)
    await user.type(box, 'My overview.')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Draft saved.')).toBeInTheDocument()
    await expect(stored(services)).resolves.toMatchObject({
      status: 'in_review',
      version: 2,
      draft: { overview: 'My overview.' },
    })
    // Saving again works from the new version: no conflict.
    await user.type(box, ' More.')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(async () => {
      await expect(stored(services)).resolves.toMatchObject({ version: 3 })
    })
  })

  // Proves a blank required field blocks saving, names the field, and sends nothing.
  it('blocks saving a blank overview and says which field', async () => {
    const { user, services } = renderReview()
    await user.clear(await overview())
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Enter the overview.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Overview' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(stored(services)).resolves.toMatchObject({ version: 1 })
  })

  // Proves parts can be added and removed, and what is on screen is what is saved.
  it('adds and removes parts', async () => {
    const { user, services } = renderReview()
    await overview()

    // Add a concept, fill it in.
    await user.click(screen.getByRole('button', { name: 'Add key concept' }))
    await user.type(screen.getByRole('textbox', { name: 'Concept 2 title' }), 'Span')
    await user.type(
      screen.getByRole('textbox', { name: 'Concept 2 explanation' }),
      'All combinations.',
    )
    // Remove the first topic and the confusion area.
    await user.click(screen.getByRole('button', { name: 'Remove topic 1' }))
    await user.click(screen.getByRole('button', { name: 'Remove confusion 1' }))
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await screen.findByText('Draft saved.')
    const { draft } = await stored(services)
    expect(
      draft.keyConcepts.map((concept: SummaryDraft['keyConcepts'][number]) => concept.title),
    ).toEqual(['Basis', 'Span'])
    expect(draft.keyTopics).toEqual([])
    expect(draft.confusionAreas).toEqual([])
  })

  // Proves a new concept left blank blocks saving and names the missing part.
  it('blocks saving an empty new concept', async () => {
    const { user } = renderReview()
    await overview()

    await user.click(screen.getByRole('button', { name: 'Add key concept' }))
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Enter the concept title.')).toBeInTheDocument()
    expect(screen.getByText('Enter the concept explanation.')).toBeInTheDocument()
  })

  // Proves Approve & Publish asks first, and cancelling changes nothing.
  it('asks before publishing, and Cancel publishes nothing', async () => {
    const { user, services } = renderReview()
    await overview()

    await user.click(screen.getByRole('button', { name: 'Approve & Publish' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Publish this summary?' })
    expect(dialog).toHaveTextContent('Students in MTH 202 will see it.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    await expect(stored(services)).resolves.toMatchObject({ status: 'in_review', version: 1 })
    // Still editable.
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument()
  })

  // Proves confirming publishes what is on screen, even unsaved, and the page turns read-only.
  it('publishes the edited draft after confirmation and becomes read-only', async () => {
    const { user, services } = renderReview()
    const box = await overview()
    await user.clear(box)
    await user.type(box, 'Final overview.')

    await user.click(screen.getByRole('button', { name: 'Approve & Publish' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Publish this summary?' })
    await user.click(within(dialog).getByRole('button', { name: 'Approve & Publish' }))

    // Read-only: the text, who and when, and no edit or publish actions.
    expect(await screen.findByText(/Published .* by Sarah Mbarga/)).toBeInTheDocument()
    expect(screen.getByText('Final overview.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve & Publish' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await expect(stored(services)).resolves.toMatchObject({
      status: 'published',
      draft: { overview: 'Final overview.' },
    })
    // Not in the queue any more.
    await expect(services.review.listReviewQueue()).resolves.toEqual([])
  })

  // Proves publishing is blocked, with the message, when a required field is blank.
  it('does not ask to publish an invalid draft', async () => {
    const { user } = renderReview()
    await user.clear(await overview())

    await user.click(screen.getByRole('button', { name: 'Approve & Publish' }))

    expect(await screen.findByText('Enter the overview.')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  // Proves a draft that changed meanwhile is refused with Reload, nothing is overwritten, and
  // Reload brings in the newer text.
  it('handles a draft that changed in another tab', async () => {
    const { user, services } = renderReview()
    const box = await overview()
    // Another tab saves first.
    const current = await stored(services)
    await services.review.saveDraft(
      's1',
      { ...current.draft, overview: 'Saved elsewhere.' },
      current.version,
    )

    await user.clear(box)
    await user.type(box, 'My stale edit.')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(
      await screen.findByText(/This draft changed\. Reload to see the latest\./),
    ).toBeInTheDocument()
    await expect(stored(services)).resolves.toMatchObject({
      draft: { overview: 'Saved elsewhere.' },
    })
    // Reload shows the newer draft.
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Overview' })).toHaveValue('Saved elsewhere.')
    })
    expect(screen.queryByText(/This draft changed/)).not.toBeInTheDocument()
  })

  // Proves leaving with unsaved edits asks first, Keep editing stays, and Leave goes.
  it('asks before leaving with unsaved edits', async () => {
    const { user, router } = renderReview()
    await user.type(await overview(), ' Edited.')

    // Keep editing: stays on the review.
    await user.click(screen.getByRole('link', { name: 'MTH 202 Linear Algebra' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(router.state.location.pathname).toBe('/teacher/reviews/s1')

    // Leave: goes to the course.
    await user.click(screen.getByRole('link', { name: 'MTH 202 Linear Algebra' }))
    const again = await screen.findByRole('alertdialog', { name: 'Leave without saving?' })
    await user.click(within(again).getByRole('button', { name: 'Leave' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/teacher/courses/mth-202')
    })
  })

  // Proves leaving without edits never asks.
  it('does not ask when nothing was edited', async () => {
    const { user, router } = renderReview()
    await overview()

    await user.click(screen.getByRole('link', { name: 'MTH 202 Linear Algebra' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/teacher/courses/mth-202')
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  // Proves signing out is never held up by the unsaved-changes question.
  it('lets the teacher sign out with unsaved edits', async () => {
    const { user, router } = renderReview()
    await user.type(await overview(), ' Edited.')

    await user.click(screen.getByRole('button', { name: 'Account menu for Sarah Mbarga' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/teacher/login')
    })
  })

  // Proves a published summary opens read-only from the start.
  it('shows a published summary read-only', async () => {
    renderReview(reviewPlatform('published'))

    expect(await screen.findByText(/Published .* by Sarah Mbarga/)).toBeInTheDocument()
    expect(screen.getByText('The AI overview.')).toBeInTheDocument()
    expect(screen.getByText('Basis')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve & Publish' })).not.toBeInTheDocument()
  })

  // Proves a summary not yet drafted says so and offers no editor.
  it.each([
    ['collecting', 'Collecting notes.'],
    ['processing', 'AI is drafting.'],
  ] as const)('shows a %s summary as not ready', async (stage, title) => {
    renderReview(reviewPlatform(stage))

    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve & Publish' })).not.toBeInTheDocument()
  })

  // SECURITY: proves another teacher's summary and an unknown one show the same not-found page.
  it.each(['s1', 'nope'])('shows not-found for %s', async (summaryId) => {
    const platform = reviewPlatform()
    const [course] = platform.courses
    if (course) course.teacherId = 'someone-else'
    renderReview(platform, summaryId)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Summary not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the review queue' })).toHaveAttribute(
      'href',
      '/teacher/reviews',
    )
  })

  // Proves the loading state is announced before the data arrives.
  it('shows a loading state first', async () => {
    renderReview()
    expect(await screen.findByRole('status', { name: 'Loading the summary' })).toBeInTheDocument()
  })

  // Proves the editor has no accessibility violations.
  it('has no accessibility violations', async () => {
    const { container } = renderReview()
    await overview()
    await expectNoAxeViolations(container)
  })

  // Proves the read-only view has none either.
  it('has no accessibility violations when published', async () => {
    const { container } = renderReview(reviewPlatform('published'))
    await screen.findByText(/Published .* by Sarah Mbarga/)
    await expectNoAxeViolations(container)
  })
})
