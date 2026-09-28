/**
 * The demo note service. Notes live in memory and, when a store is given, in localStorage under
 * the mock-data prefix, so a reload keeps them ("done when" of M4). Sign-out keeps them too,
 * because they stand in for the server (lib/storage.ts).
 */

// Checks stored notes before they are used.
import { z } from 'zod'

// The error type every failure becomes.
import { AppError } from '@/lib/errors'
// The note rules shared with the form.
import { noteInputSchema, resolveNoteTitle, type NoteInput } from '@/lib/notes'
// Strips unsafe markup before a note is stored.
import { sanitizeHtml } from '@/lib/sanitizeHtml'
// The mock-data key prefix.
import { MOCK_DATA_PREFIX } from '@/lib/storage'
// Shapes.
import type { ClassSession, ID, Note } from '@/types/domain'

// The interface implemented.
import type { NoteFilter, NoteService } from '../types'

// The fake network delay.
import { simulateLatency } from './latency'

/** Where the demo keeps its notes. */
export const MOCK_NOTES_KEY = `${MOCK_DATA_PREFIX}notes`

/** The part of Storage the service uses. */
interface NoteStore {
  // Reads the saved list.
  getItem(key: string): string | null
  // Writes the list.
  setItem(key: string, value: string): void
}

/** What the factory needs. */
interface MockNoteOptions {
  // The notes to start with when nothing is stored.
  seedNotes: readonly Note[]
  // The classes a note may belong to (the student's enrolled classes).
  classes: readonly ClassSession[]
  // The student every new note belongs to.
  studentId: ID
  // Delay per call; tests pass 0.
  latencyMs: number
  // Optional persistence; tests usually leave it out.
  store?: NoteStore
  // The clock; tests can pin it.
  now?: () => Date
}

/**
 * The shape stored notes must have.
 * SECURITY: localStorage can be edited in developer tools. Anything that doesn't match is
 * ignored and the demo starts from the seed again, rather than feeding odd data to the pages.
 */
const storedNotesSchema = z.array(
  z.object({
    id: z.string(),
    studentId: z.string(),
    courseId: z.string(),
    classId: z.string(),
    title: z.string().exactOptional(),
    contentHtml: z.string(),
    tags: z.array(z.string()),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
)

/** Reads the stored notes, or null when there are none or they are unusable. */
function readStored(store: NoteStore | undefined): Note[] | null {
  // No persistence configured.
  if (!store) return null
  try {
    // The saved text.
    const raw = store.getItem(MOCK_NOTES_KEY)
    // Nothing saved yet.
    if (raw === null) return null
    // Keep it only if every note has the right shape.
    const parsed = storedNotesSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    // Blocked storage or broken JSON: start from the seed.
    return null
  }
}

/** Newest edit first. */
function newestFirst(notes: readonly Note[]) {
  // Copy, then sort.
  return [...notes].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

/** Builds the demo note service. */
export function createMockNoteService({
  seedNotes,
  classes,
  studentId,
  latencyMs,
  store,
  now = () => new Date(),
}: MockNoteOptions): NoteService {
  // The working list: what was stored, else a copy of the seed.
  let notes: Note[] = readStored(store) ?? structuredClone([...seedNotes])

  /** Writes the list back, when persistence is on. */
  function persist() {
    try {
      // The whole list; the demo holds a few dozen notes at most.
      store?.setItem(MOCK_NOTES_KEY, JSON.stringify(notes))
    } catch {
      // Full or blocked storage: the change still holds until the page reloads.
    }
  }

  /** The note with this ID, or not_found. */
  function find(noteId: ID) {
    // SECURITY: only the student's own notes are ever found, as Row Level Security will ensure
    // on the real backend (section 12.2).
    const note = notes.find((n) => n.id === noteId && n.studentId === studentId)
    // Missing.
    if (!note) throw new AppError('not_found', 'Note not found')
    // Found.
    return note
  }

  /** Checks the input against the note rules and the student's classes; returns the clean values. */
  function validate(input: NoteInput) {
    // The shared rules; the first problem becomes the message.
    const parsed = noteInputSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError(
        'validation',
        parsed.error.issues[0]?.message ?? 'Check the note and try again.',
      )
    }
    // SECURITY: the class must be one of the student's, so a crafted request can't file a note
    // under someone else's class.
    const session = classes.find((c) => c.id === parsed.data.classId)
    if (!session) throw new AppError('validation', 'Choose a class from your courses.')
    // SECURITY: markup is cleaned before storage too (defence in depth; SafeHtml still cleans
    // on display), so a stored note never holds scripts or event handlers.
    const contentHtml = sanitizeHtml(parsed.data.contentHtml)
    // The clean values, with the course taken from the class and the title resolved (FR-NTE-1).
    return {
      classId: session.id,
      courseId: session.courseId,
      title: resolveNoteTitle(parsed.data.title, contentHtml),
      contentHtml,
      tags: parsed.data.tags,
    }
  }

  return {
    // The student's notes, filtered, newest first.
    listMyNotes: async (filter: NoteFilter = {}) => {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Own notes that pass the filter.
      const mine = notes.filter(
        (n) =>
          n.studentId === studentId &&
          (filter.courseId === undefined || n.courseId === filter.courseId) &&
          (filter.classId === undefined || n.classId === filter.classId),
      )
      // Copies, newest first.
      return structuredClone(newestFirst(mine))
    },

    // One note.
    getNote: async (noteId) => {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Copy of the note, or not_found.
      return structuredClone(find(noteId))
    },

    // A new note.
    createNote: async (input) => {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // Clean values, or a validation error.
      const values = validate(input)
      // Created and edited now.
      const time = now().toISOString()
      // A random ID, as a database would give.
      const note: Note = {
        id: `note-${crypto.randomUUID()}`,
        studentId,
        ...values,
        createdAt: time,
        updatedAt: time,
      }
      // Store and save.
      notes = [...notes, note]
      persist()
      // A copy for the caller.
      return structuredClone(note)
    },

    // An edit.
    updateNote: async (noteId, input) => {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // The existing note (or not_found), then the clean values (or a validation error).
      const existing = find(noteId)
      const values = validate(input)
      // Same ID and creation time; new content and edit time.
      const updated: Note = { ...existing, ...values, updatedAt: now().toISOString() }
      // Replace and save.
      notes = notes.map((n) => (n.id === noteId ? updated : n))
      persist()
      // A copy for the caller.
      return structuredClone(updated)
    },

    // A delete, for good (FR-NTE-8).
    deleteNote: async (noteId) => {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // not_found if it isn't the student's.
      find(noteId)
      // Remove and save.
      notes = notes.filter((n) => n.id !== noteId)
      persist()
    },
  }
}
