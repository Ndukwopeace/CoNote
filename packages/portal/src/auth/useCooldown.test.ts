/**
 * Tests for the countdown that spaces out requests for another sign-in code.
 */

// Rendering a hook, and acting on state changes.
import { act, renderHook } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The unit under test.
import { useCooldown } from './useCooldown'

describe('useCooldown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // Proves nothing is counted until the wait is started.
  it('starts at zero', () => {
    const { result } = renderHook(() => useCooldown(3))

    expect(result.current.remaining).toBe(0)
  })

  // Proves the wait counts down a second at a time and ends at zero.
  it('counts down to zero once started', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCooldown(3))

    act(() => {
      result.current.start()
    })
    expect(result.current.remaining).toBe(3)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remaining).toBe(2)
    // Each second is scheduled after the page redraws, so the clock moves one second at a time.
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remaining).toBe(1)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remaining).toBe(0)
  })

  // Proves starting again restarts the wait from the full length.
  it('restarts when started again', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCooldown(3))

    act(() => {
      result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remaining).toBe(2)
    act(() => {
      result.current.start()
    })

    expect(result.current.remaining).toBe(3)
  })
})
