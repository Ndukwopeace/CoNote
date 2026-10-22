/**
 * Tests for the unsent text kept for Home's composer (FR-NTE-5): one draft per class, restored
 * when the class comes back, and gone once the note is sent.
 */

// Testing helpers for hooks.
import { act, renderHook } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Draft storage rules and the save delay.
import { draftKey, loadDraft } from '@/lib/noteDrafts'

// The hook under test.
import { DRAFT_SAVE_DELAY_MS, useComposerDraft } from './useComposerDraft'

// Timers are faked so the save delay can be stepped through; storage starts empty.
beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
})

/** The text stored for a class, or null. */
function stored(classId: string) {
  return loadDraft(window.localStorage, draftKey({ classId }), new Date())?.contentHtml ?? null
}

describe('useComposerDraft', () => {
  // Proves typing is written to storage after a pause, not on every key.
  it('saves the text after a pause in typing', () => {
    const { result } = renderHook(() => useComposerDraft('c1', true))

    act(() => {
      result.current.setText('Waterfall')
    })
    expect(stored('c1')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })

    expect(stored('c1')).toBe('<p>Waterfall</p>')
  })

  // Proves the text comes back when the page is opened again for the same class.
  it('restores the draft for the class on the next visit', () => {
    const first = renderHook(() => useComposerDraft('c1', true))
    act(() => {
      first.result.current.setText('Line one\nLine two')
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })
    first.unmount()

    const second = renderHook(() => useComposerDraft('c1', true))

    expect(second.result.current.text).toBe('Line one\nLine two')
  })

  // Proves each class keeps its own draft: switching class swaps the text, switching back
  // brings the first one back.
  it('keeps a separate draft for each class', () => {
    const { result, rerender } = renderHook(({ id }) => useComposerDraft(id, true), {
      initialProps: { id: 'c1' },
    })
    act(() => {
      result.current.setText('for class one')
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })

    rerender({ id: 'c2' })
    expect(result.current.text).toBe('')
    act(() => {
      result.current.setText('for class two')
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })
    rerender({ id: 'c1' })

    expect(result.current.text).toBe('for class one')
  })

  // Proves a pending save is not written into the next class's draft when the class changes.
  it('does not carry unsaved typing into another class', () => {
    const { result, rerender } = renderHook(({ id }) => useComposerDraft(id, true), {
      initialProps: { id: 'c1' },
    })
    act(() => {
      result.current.setText('typed just before switching')
    })

    rerender({ id: 'c2' })
    act(() => {
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })

    expect(stored('c2')).toBeNull()
    expect(stored('c1')).toBe('<p>typed just before switching</p>')
  })

  // Proves clearing (after a note is sent) empties the box and removes the stored draft, even
  // when a save was still waiting.
  it('clears the text and the stored draft', () => {
    const { result } = renderHook(() => useComposerDraft('c1', true))
    act(() => {
      result.current.setText('sent soon')
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
      result.current.setText('sent soon, edited')
    })

    act(() => {
      result.current.clear()
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })

    expect(result.current.text).toBe('')
    expect(stored('c1')).toBeNull()
  })

  // Proves emptying the box removes the draft, so a blank draft is never offered.
  it('removes the draft when the text is emptied', () => {
    const { result } = renderHook(() => useComposerDraft('c1', true))
    act(() => {
      result.current.setText('something')
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })

    act(() => {
      result.current.setText('   ')
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })

    expect(stored('c1')).toBeNull()
  })

  // Proves nothing is read or written while a note is being edited: its text is not a draft.
  it('keeps no draft while disabled', () => {
    window.localStorage.setItem(
      draftKey({ classId: 'c1' }),
      JSON.stringify({
        classId: 'c1',
        title: '',
        contentHtml: '<p>old draft</p>',
        tags: [],
        savedAt: new Date().toISOString(),
      }),
    )
    const { result } = renderHook(() => useComposerDraft('c1', false))

    expect(result.current.text).toBe('')
    act(() => {
      result.current.setText('an edit')
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })

    expect(stored('c1')).toBe('<p>old draft</p>')
  })

  // Proves that with no class chosen yet the text is kept under the "no class" draft.
  it('keeps a draft even before a class is chosen', () => {
    const { result } = renderHook(() => useComposerDraft(undefined, true))
    act(() => {
      result.current.setText('before choosing')
      vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS)
    })

    expect(loadDraft(window.localStorage, draftKey({}), new Date())?.contentHtml).toBe(
      '<p>before choosing</p>',
    )
  })
})
