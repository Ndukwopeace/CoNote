/**
 * The unsent text of Home's composer, kept in the browser so a reload, a closed tab or a trip to
 * another page loses nothing (FR-NTE-5). One draft per class, saved after a pause in typing,
 * restored when the class is chosen again, and removed once the note is sent.
 */

// State, stable callbacks and the clean-up that saves what is waiting.
import { useCallback, useEffect, useRef, useState } from 'react'

// Draft storage rules, and the note text rules.
import { draftKey, loadDraft, removeDraft, saveDraft } from '@/lib/noteDrafts'
import { htmlToComposerText, textToNoteHtml } from '@/lib/notes'

// Where drafts are kept.
import { draftStorage } from './draftStorage'

/** How long typing must pause before the draft is written: often enough, without a write per key. */
export const DRAFT_SAVE_DELAY_MS = 800

/** A save that is waiting for the pause. */
interface PendingSave {
  key: string
  classId: string
  text: string
}

/** Writes `text` as the draft under `key`; an empty text removes the draft instead. */
function write({ key, classId, text }: PendingSave) {
  // Nothing worth keeping: no draft.
  if (text.trim() === '') {
    removeDraft(draftStorage(), key)
    return
  }
  // The text as paragraphs, like a saved note, so one format is read back.
  saveDraft(
    draftStorage(),
    key,
    { classId, title: '', contentHtml: textToNoteHtml(text), tags: [] },
    new Date(),
  )
}

/** The text saved under `key`, or '' when there is none. */
function read(key: string): string {
  const draft = loadDraft(draftStorage(), key, new Date())
  return draft ? htmlToComposerText(draft.contentHtml) : ''
}

/**
 * The composer's text for `classId` (undefined while none is chosen). While `enabled` is false
 * (a note is being edited) nothing is read or written: the text is that note's, not a draft.
 */
export function useComposerDraft(classId: string | undefined, enabled: boolean) {
  // The draft's storage key for this class.
  const key = draftKey({ ...(classId ? { classId } : {}) })
  // The text, and the key it was loaded for.
  const [text, setTextState] = useState(() => (enabled ? read(key) : ''))
  const [loadedKey, setLoadedKey] = useState(key)
  // The save waiting for the pause, and its timer.
  const pending = useRef<PendingSave | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // A different class: load its draft (the previous one is saved by the effect below).
  if (loadedKey !== key) {
    setLoadedKey(key)
    setTextState(enabled ? read(key) : '')
  }

  /** Writes the waiting save now. */
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (pending.current) write(pending.current)
    pending.current = null
  }, [])

  // Leaving a class, or the page, saves what is waiting under the class it was typed for.
  useEffect(() => flush, [key, flush])

  /** Sets the text and schedules its save, replacing any save still waiting. */
  const setText = useCallback(
    (value: string) => {
      setTextState(value)
      if (!enabled) return
      clearTimeout(timer.current)
      pending.current = { key, classId: classId ?? '', text: value }
      timer.current = setTimeout(flush, DRAFT_SAVE_DELAY_MS)
    },
    [enabled, key, classId, flush],
  )

  /** Empties the box and removes the draft, and any save still waiting (after a note is sent). */
  const clear = useCallback(() => {
    clearTimeout(timer.current)
    pending.current = null
    if (enabled) removeDraft(draftStorage(), key)
    setTextState('')
  }, [enabled, key])

  return { text, setText, clear }
}
