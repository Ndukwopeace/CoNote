/**
 * Tests for the staff top bar's feedback button (D125): it opens the shared form, and what is sent
 * carries the page the sender was on (the path only), never a query or a hash.
 */

// Rendering and user input.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// A router, so the button can read the address.
import { MemoryRouter } from 'react-router'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The unit under test.
import { FeedbackButton } from './FeedbackButton'

/** Renders the button at `address` over a service whose send is a spy. */
function renderButton(address: string) {
  const send = vi.fn(() => Promise.resolve())
  render(
    <MemoryRouter initialEntries={[address]}>
      <FeedbackButton service={{ send }} />
    </MemoryRouter>,
  )
  return { send, user: userEvent.setup() }
}

describe('FeedbackButton', () => {
  // Proves a click opens the form, and a send goes out with the kind, message and score.
  it('opens the form and sends what was written', async () => {
    const { send, user } = renderButton('/admin/users')

    await user.click(screen.getByRole('button', { name: 'Feedback' }))
    await user.type(screen.getByLabelText('Your message'), 'The table is slow')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'bug', message: 'The table is slow', rating: null }),
      )
    })
  })

  // SECURITY: proves the page that is recorded has no query and no hash, which can hold a token.
  it('records the path without the query or the hash', async () => {
    const { send, user } = renderButton('/admin/reset-password?code=secret#token=abc')

    await user.click(screen.getByRole('button', { name: 'Feedback' }))
    await user.type(screen.getByLabelText('Your message'), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ page: '/admin/reset-password' }))
    })
  })
})
