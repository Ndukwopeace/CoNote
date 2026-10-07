/**
 * Unsaved note drafts, kept in the browser so an accidental reload loses nothing (FR-NTE-5).
 * Stored under the "conote:" prefix, so sign-out deletes them with the rest of the student's data.
 */

// Checks stored drafts before they are used.
import { z } from 'zod'

// Namespaced storage keys.
import { storageKey } from './storage'

/** Drafts older than this are deleted without asking (FR-NTE-5): 7 days. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** The part of Storage drafts use; a narrow type so tests can pass a fake. */
export interface DraftStore {
  // Reads a value.
  getItem(key: string): string | null
  // Writes a value.
  setItem(key: string, value: string): void
  // Deletes a value.
  removeItem(key: string): void
}

/** What a draft holds: the form's values. */
export interface DraftContent {
  // The chosen class ('' while none is chosen).
  classId: string
  // The typed title.
  title: string
  // The editor's HTML.
  contentHtml: string
  // The chosen tags.
  tags: string[]
}

/** A stored draft: the content plus when it was saved. */
export type Draft = DraftContent & { savedAt: string }

/**
 * The shape a stored draft must have.
 * SECURITY: storage can be edited in developer tools, so a draft is checked before it reaches
 * the form. The HTML still only ever renders through the editor and SafeHtml.
 */
const draftSchema = z.object({
  classId: z.string(),
  title: z.string(),
  contentHtml: z.string(),
  tags: z.array(z.string()),
  savedAt: z.iso.datetime(),
})

/** The storage key for a draft: per note when editing, per class when new (FR-NTE-5). */
export function draftKey({ noteId, classId }: Readonly<{ noteId?: string; classId?: string }>) {
  // Editing: one draft per note.
  if (noteId) return storageKey('draft', 'note', noteId)
  // New note for a known class: one draft per class.
  if (classId) return storageKey('draft', 'class', classId)
  // New note with no class chosen yet.
  return storageKey('draft', 'new')
}

/** Saves a draft. Blocked storage is ignored: the draft is a convenience, not a guarantee. */
export function saveDraft(store: DraftStore, key: string, content: DraftContent, now: Date) {
  try {
    // The content plus the time, as JSON.
    store.setItem(key, JSON.stringify({ ...content, savedAt: now.toISOString() }))
  } catch {
    // Full or blocked storage: carry on without a draft.
  }
}

/** Deletes a draft. Blocked storage is ignored. */
export function removeDraft(store: DraftStore, key: string) {
  try {
    // Gone.
    store.removeItem(key)
  } catch {
    // Blocked storage: nothing was saved there either.
  }
}

/**
 * The draft under `key`, or null. Drafts that are corrupt, tampered with or older than 7 days
 * are deleted on the way.
 */
export function loadDraft(store: DraftStore, key: string, now: Date): Draft | null {
  // The raw text; blocked storage counts as "no draft".
  let raw: string | null
  try {
    raw = store.getItem(key)
  } catch {
    return null
  }
  // Nothing saved.
  if (raw === null) return null

  // Parse and check the shape.
  let draft: Draft | null = null
  try {
    // JSON.parse returns unknown data; the schema decides whether it is a draft.
    const parsed = draftSchema.safeParse(JSON.parse(raw))
    draft = parsed.success ? parsed.data : null
  } catch {
    // Not JSON at all.
    draft = null
  }
  // Unusable, or expired: delete it so it is never offered again.
  if (!draft || now.getTime() - Date.parse(draft.savedAt) > DRAFT_MAX_AGE_MS) {
    removeDraft(store, key)
    return null
  }
  // A usable draft.
  return draft
}
