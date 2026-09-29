/**
 * Tests for the demo note service's persistence: notes survive a reload, and tampered storage
 * is ignored.
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// The unit under test and its storage key.
import { createMockNoteService, MOCK_NOTES_KEY } from './mockNotes'
// Demo data.
import { createSeed } from './seed'

/** A note service over fresh demo data, saving to localStorage. */
function createService() {
  // Fresh seed each time.
  const seed = createSeed(new Date())
  return createMockNoteService({
    seedNotes: seed.notes,
    classes: seed.classes,
    studentId: 'student-victory',
    latencyMs: 0,
    store: window.localStorage,
  })
}

// Each test starts with empty storage.
beforeEach(() => {
  window.localStorage.clear()
})

describe('mock note service persistence', () => {
  // Proves the M4 "done when": a reload (a new service over the same storage) keeps the note.
  it('keeps notes across a reload', async () => {
    // Arrange: create a note.
    const created = await createService().createNote({
      classId: 'swe-311-c4',
      title: 'Kept',
      contentHtml: '<p>Still here</p>',
      tags: [],
    })

    // Act: "reload".
    const reloaded = createService()

    // Assert.
    await expect(reloaded.getNote(created.id)).resolves.toEqual(created)
  })

  // Proves deletes survive a reload too.
  it('keeps deletions across a reload', async () => {
    // Arrange.
    await createService().deleteNote('note-1')

    // Assert.
    await expect(createService().getNote('note-1')).rejects.toMatchObject({ kind: 'not_found' })
  })

  // SECURITY: proves edited storage that doesn't look like notes is ignored.
  it('falls back to the demo notes when storage is tampered with', async () => {
    // Arrange.
    window.localStorage.setItem(MOCK_NOTES_KEY, '[{"id":1}]')

    // Assert: the seed's 11 notes.
    await expect(createService().listMyNotes()).resolves.toHaveLength(11)
  })
})
