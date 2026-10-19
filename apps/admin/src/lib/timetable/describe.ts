/**
 * The words the import review uses for counts and weekly slots (D105).
 */

// The slot shape.
import type { PlannedSlot } from './types'

/** Short day names, Monday first, indexed by weekday − 1. */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "1 course" or "4 courses": `many` is the plural when it is not just an "s" more. */
export function countOf(count: number, one: string, many = `${one}s`): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

/** A course's weekly slots as one line: "Mon 08:00–12:00, Thu 13:00–17:00". */
export function describeSlots(slots: readonly PlannedSlot[]): string {
  if (slots.length === 0) return 'No weekly slot'
  return slots.map((slot) => `${DAYS[slot.weekday - 1] ?? ''} ${slot.start}–${slot.end}`).join(', ')
}
