/**
 * Tests for the "Feedback" item in the account menu (D125): it opens the shared form, and a
 * send reaches the app's feedback service with the page the student was on.
 */

// Queries the rendered page, and waiting.
import { screen, waitFor } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The real route table, so the menu sits in the real portal shell.
import { routes } from '@/app/routes'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

describe('UserMenu feedback item', () => {
  // Proves the item opens the form, and a send carries the kind, message and page (path only).
  it('opens the feedback form and sends it with the page', async () => {
    // Arrange: a feedback service that records what it is sent.
    const send = vi.fn(() => Promise.resolve())
    const { user } = renderWithRouter({
      routes,
      path: '/courses?tab=old#top',
      session: makeSession(),
      services: { feedback: { send } },
    })

    // Act.
    await user.click(await screen.findByRole('button', { name: /Account menu/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Feedback' }))
    await user.type(await screen.findByLabelText('Your message'), 'Love the summaries')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    // Assert.
    await waitFor(() => {
      expect(send).toHaveBeenCalledWith({
        kind: 'bug',
        message: 'Love the summaries',
        rating: null,
        page: '/courses',
      })
    })
    expect(await screen.findByText('Thank you. Your feedback was sent.')).toBeVisible()
  })
})
