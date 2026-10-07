/**
 * Draft handling for the note form (FR-NTE-5): the draft offered when the form opens, saving as
 * the student types, and removal after a save or a discard.
 */

// State, stable callbacks, and the timer clean-up.
import { useCallback, useEffect, useRef, useState } from 'react'

// Draft storage rules.
import { loadDraft, removeDraft, saveDraft, type Draft, type DraftContent } from '@/lib/noteDrafts'

// Where drafts are kept.
import { draftStorage } from './draftStorage'

/** How long typing must pause before the draft is written: often enough, without a write per key. */
export const DRAFT_SAVE_DELAY_MS = 800

/** The draft for `key`: what is on offer, and the functions to save, restore and discard it. */
export function useNoteDraft(key: string) {
  // The draft found when the form opened, until it is restored or discarded.
  const [offered, setOffered] = useState<Draft | null>(() =>
    loadDraft(draftStorage(), key, new Date()),
  )
  // The pending save.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Cancel a pending save when the form closes; the last pause's content is already written.
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  /** Saves `content` after a short pause; each call replaces the previous pending save. */
  const schedule = useCallback(
    (content: DraftContent) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        saveDraft(draftStorage(), key, content, new Date())
      }, DRAFT_SAVE_DELAY_MS)
    },
    [key],
  )

  /** Deletes the draft now, and any save still waiting (after a save or a discard). */
  const clear = useCallback(() => {
    clearTimeout(timer.current)
    removeDraft(draftStorage(), key)
    setOffered(null)
  }, [key])

  /** Hides the banner and hands back the offered draft, which stays stored until saved. */
  const restore = useCallback(() => {
    const draft = offered
    setOffered(null)
    return draft
  }, [offered])

  return { offered, schedule, clear, restore }
}
