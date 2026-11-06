/**
 * Tests for the window in which students may write notes about a class (D123): from its start until
 * one hour after its end. The database enforces the same rule; this is the copy the apps use to
 * choose classes and to explain a refusal.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { NOTES_WINDOW_MINUTES, noteWindowRefusal, noteWindowState } from './noteWindow'

/** A class from 09:00 to 11:00 UTC on 28 October 2026. */
const CLASS = { startsAt: '2026-10-28T09:00:00Z', endsAt: '2026-10-28T11:00:00Z' }

describe('noteWindowState', () => {
  // Proves the window is one hour, as the owner decided.
  it('is sixty minutes long', () => {
    expect(NOTES_WINDOW_MINUTES).toBe(60)
  })

  // Proves a class that has not begun is not open, and says why.
  it('is "not_started" before the class begins', () => {
    expect(noteWindowState(CLASS, new Date('2026-10-28T08:59:59Z'))).toBe('not_started')
  })

  // Proves the start itself counts and the whole class is open.
  it('is "open" from the first minute and through the class', () => {
    expect(noteWindowState(CLASS, new Date('2026-10-28T09:00:00Z'))).toBe('open')
    expect(noteWindowState(CLASS, new Date('2026-10-28T10:30:00Z'))).toBe('open')
  })

  // Proves the hour after the class is still open, up to and including its last moment.
  it('stays "open" for an hour after the class ends', () => {
    expect(noteWindowState(CLASS, new Date('2026-10-28T11:00:00Z'))).toBe('open')
    expect(noteWindowState(CLASS, new Date('2026-10-28T12:00:00Z'))).toBe('open')
  })

  // Proves the window closes right after that hour.
  it('is "closed" once the hour has passed', () => {
    expect(noteWindowState(CLASS, new Date('2026-10-28T12:00:01Z'))).toBe('closed')
    expect(noteWindowState(CLASS, new Date('2026-10-30T09:00:00Z'))).toBe('closed')
  })

  // Proves times that cannot be read never open the window.
  it('is "closed" when the times cannot be read', () => {
    expect(noteWindowState({ startsAt: 'soon', endsAt: 'later' }, new Date())).toBe('closed')
  })
})

describe('noteWindowRefusal', () => {
  // Proves an open class gives no refusal, and the other two say why in plain words.
  it('explains why a class cannot take a note, and says nothing when it can', () => {
    expect(noteWindowRefusal('open')).toBeUndefined()
    expect(noteWindowRefusal('not_started')).toBe('That class has not started yet.')
    expect(noteWindowRefusal('closed')).toBe('Notes for that class closed one hour after it ended.')
  })
})
