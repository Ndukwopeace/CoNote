/**
 * "Download my notes" (FR-SET-4): the student's notes as readable JSON.
 */

// The note shape.
import type { Note } from '@/types/domain'

/** The notes and the export time, as indented JSON a person can read. */
export function notesExport(notes: readonly Note[], now: Date): string {
  return JSON.stringify({ exportedAt: now.toISOString(), notes }, null, 2)
}
