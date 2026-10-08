/**
 * Tests for the confirmation dialog used before deleting or discarding (FR-NTE-5, FR-NTE-8).
 */

// Rendering, queries and user input.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The unit under test.
import { ConfirmDialog } from './ConfirmDialog'

/** Renders an open dialog with spy callbacks. */
function renderDialog() {
  // Spies.
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Delete this note?"
      description="This can't be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
    />,
  )
  return { onConfirm, onOpenChange }
}

describe('ConfirmDialog', () => {
  // Proves the question and consequence are shown, and confirming calls back.
  it('confirms', async () => {
    // Arrange.
    const { onConfirm } = renderDialog()

    // Act.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }))

    // Assert.
    expect(screen.getByRole('alertdialog', { name: 'Delete this note?' })).toHaveTextContent(
      "This can't be undone.",
    )
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  // Proves Cancel closes without confirming, and is focused first so Enter is safe.
  it('cancels, with Cancel focused first', async () => {
    // Arrange.
    const { onConfirm, onOpenChange } = renderDialog()

    // Assert: the safe choice has focus.
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    // Act.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))

    // Assert.
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
