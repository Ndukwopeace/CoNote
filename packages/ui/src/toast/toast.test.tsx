/**
 * Tests for toasts: short messages after a save, delete or failure (FR-NTE-6, section 11).
 */

// Rendering, queries and user input.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The units under test.
import { TOAST_DURATION_MS, ToastProvider } from './ToastProvider'
import { useToast } from './useToast'

/** A button that shows a toast when clicked. */
function Trigger({ tone }: Readonly<{ tone: 'success' | 'error' }>) {
  // The toast function.
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={() => {
        toast[tone](tone === 'success' ? 'Note saved.' : "Couldn't save.")
      }}
    >
      Show
    </button>
  )
}

/** Renders the provider around a trigger. */
function renderToast(tone: 'success' | 'error' = 'success') {
  return render(
    <ToastProvider>
      <Trigger tone={tone} />
    </ToastProvider>,
  )
}

// Real timers again after the timing test.
afterEach(() => {
  vi.useRealTimers()
})

describe('toasts', () => {
  // Proves a success is announced politely.
  it('shows a success message as a status', async () => {
    // Arrange.
    renderToast()

    // Act.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show' }))

    // Assert.
    expect(screen.getByRole('status')).toHaveTextContent('Note saved.')
  })

  // Proves a failure is announced at once.
  it('shows an error message as an alert', async () => {
    // Arrange.
    renderToast('error')

    // Act.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show' }))

    // Assert.
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save.")
  })

  // Proves toasts can be closed by hand.
  it('closes with the Dismiss button', async () => {
    // Arrange.
    const user = userEvent.setup()
    renderToast()
    await user.click(screen.getByRole('button', { name: 'Show' }))

    // Act.
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    // Assert.
    expect(screen.queryByText('Note saved.')).toBeNull()
  })

  // Proves toasts go away by themselves.
  it('disappears after a few seconds', () => {
    // Arrange: fake timers, and a click without userEvent (which waits on timers).
    vi.useFakeTimers()
    renderToast()
    act(() => {
      screen.getByRole('button', { name: 'Show' }).click()
    })

    // Act.
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS)
    })

    // Assert.
    expect(screen.queryByText('Note saved.')).toBeNull()
  })
})
