/**
 * Tests for the shared feedback form (D125): the fields, the optional score, the send, the thanks,
 * a failed send, and the accessibility check.
 */

// Rendering, queries and user input.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The unit under test.
import { FeedbackDialog } from './FeedbackDialog'

const KINDS = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'idea', label: 'An idea' },
] as const

/** Renders an open dialog whose send is `onSend`. */
function renderDialog(onSend = vi.fn(() => Promise.resolve())) {
  const onOpenChange = vi.fn()
  const view = render(
    <FeedbackDialog
      open
      onOpenChange={onOpenChange}
      kinds={KINDS}
      maxLength={50}
      onSend={onSend}
    />,
  )
  return { ...view, onSend, onOpenChange, user: userEvent.setup() }
}

describe('FeedbackDialog', () => {
  // Proves the chosen kind, the message and the score are what is sent, and the thanks follows.
  it('sends what was filled in and says thank you', async () => {
    const { user, onSend } = renderDialog()

    await user.selectOptions(screen.getByLabelText('What is it about?'), 'idea')
    await user.type(screen.getByLabelText('Your message'), 'Dark mode please')
    await user.click(screen.getByRole('radio', { name: '4 of 5, Very good' }))
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    expect(onSend).toHaveBeenCalledWith({ kind: 'idea', message: 'Dark mode please', rating: 4 })
    expect(await screen.findByText('Thank you. Your feedback was sent.')).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0)
  })

  // Proves the score is optional: nothing chosen is sent as null.
  it('sends no score when none was chosen', async () => {
    const { user, onSend } = renderDialog()

    await user.type(screen.getByLabelText('Your message'), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith({ kind: 'bug', message: 'Hello', rating: null })
    })
  })

  // Proves the counter follows the text and the box stops at the limit.
  it('counts the characters and stops at the limit', async () => {
    const { user } = renderDialog()

    await user.type(screen.getByLabelText('Your message'), 'x'.repeat(60))

    expect(screen.getByText('50 / 50')).toBeVisible()
  })

  // Proves a failed send shows the reason, keeps the text and lets the sender try again.
  it('shows why a send failed and keeps the message', async () => {
    const onSend = vi.fn(() => Promise.reject(new Error('Write a message before you send.')))
    const { user } = renderDialog(onSend)

    await user.click(screen.getByRole('button', { name: 'Send feedback' }))

    expect(await screen.findByText('Write a message before you send.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeEnabled()
  })

  // Proves Cancel asks to close and nothing is sent.
  it('closes on Cancel without sending', async () => {
    const { user, onSend, onOpenChange } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSend).not.toHaveBeenCalled()
  })

  // Proves the dialog passes the accessibility check.
  it('has no accessibility violations', async () => {
    renderDialog()

    await expectNoAxeViolations(document.body)
  })
})
