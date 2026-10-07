/**
 * Tests for the sign-in pages' request helper: pending state, and safe error wording.
 */

// Hook rendering and state updates.
import { act, renderHook } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'

// The unit under test.
import { useAuthRequest } from './useAuthRequest'

describe('useAuthRequest', () => {
  // Proves a successful call hands back its value and leaves no error.
  it('returns the value of a successful call', async () => {
    const { result } = renderHook(() => useAuthRequest())
    let outcome: unknown
    await act(async () => {
      outcome = await result.current.run(() => Promise.resolve(42))
    })
    expect(outcome).toEqual({ ok: true, value: 42 })
    expect(result.current.error).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  // SECURITY: proves only the safe wording reaches the screen, never a raw error's text.
  it('turns a failure into safe wording', async () => {
    const { result } = renderHook(() => useAuthRequest())
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('relation "profiles" missing')))
    })
    expect(result.current.error).toBe('Something went wrong on our side. Please try again.')
  })

  // Proves a validation message is shown as written.
  it('shows a validation message as written', async () => {
    const { result } = renderHook(() => useAuthRequest())
    await act(async () => {
      await result.current.run(() => Promise.reject(new AppError('validation', 'Not that.')))
    })
    expect(result.current.error).toBe('Not that.')
  })
})
