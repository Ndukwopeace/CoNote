/**
 * Tests for the confirmation that asks for a name to be typed before something is deleted for good.
 */

// Rendering, queries and user input.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The unit under test.
import { TypeToConfirmDialog } from './TypeToConfirmDialog'

/** Renders an open dialog asking for "CSC 101", with spy callbacks. */
function renderDialog() {
  // Spies.
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <TypeToConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Delete CSC 101 for good?"
      description="Its notes are lost."
      expected="CSC 101"
      confirmLabel="Delete course"
      onConfirm={onConfirm}
    />,
  )
  return { onConfirm, onOpenChange }
}

describe('TypeToConfirmDialog', () => {
  // Proves the button stays off until the exact words are typed, then confirms.
  it('confirms only after the name is typed', async () => {
    // Arrange.
    const { onConfirm } = renderDialog()
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'Delete course' })

    // Assert: off at first, and off for a near miss.
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('Type CSC 101 to confirm'), 'CSC 10')
    expect(button).toBeDisabled()

    // Act: finish the name (case and stray spaces don't matter).
    await user.type(screen.getByLabelText('Type CSC 101 to confirm'), '1 ')
    await user.click(button)

    // Assert.
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  // Proves the question and the consequence are shown, and the wrong name never confirms.
  it('names the consequence and ignores a click on a disabled button', async () => {
    const { onConfirm } = renderDialog()
    expect(screen.getByRole('alertdialog', { name: 'Delete CSC 101 for good?' })).toHaveTextContent(
      'Its notes are lost.',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete course' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  // Proves Cancel is focused first, so Enter never deletes, and it closes without confirming.
  it('cancels, with Cancel focused first', async () => {
    const { onConfirm, onOpenChange } = renderDialog()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
