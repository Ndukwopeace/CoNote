/**
 * Tests for unsaved note drafts kept in the browser (FR-NTE-5).
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// The functions under test.
import { DRAFT_MAX_AGE_MS, draftKey, loadDraft, removeDraft, saveDraft } from './noteDrafts'

/** A draft's content. */
const CONTENT = {
  classId: 'swe-311-c1',
  title: 'Draft',
  contentHtml: '<p>Hi</p>',
  tags: ['Question'],
}
/** A fixed "now". */
const NOW = new Date(2026, 8, 28, 9, 0)

// Each test starts with empty storage.
beforeEach(() => {
  window.localStorage.clear()
})

describe('draftKey', () => {
  // Proves a new note's draft is per class and an edit's draft is per note, in the app namespace.
  it('keys drafts by class for new notes and by note for edits', () => {
    expect(draftKey({ classId: 'c1' })).toBe('conote:draft:class:c1')
    expect(draftKey({ noteId: 'n1' })).toBe('conote:draft:note:n1')
    expect(draftKey({})).toBe('conote:draft:new')
  })
})

describe('saveDraft and loadDraft', () => {
  // Proves a saved draft comes back with its time.
  it('round-trips a draft', () => {
    // Act.
    saveDraft(window.localStorage, 'conote:draft:x', CONTENT, NOW)

    // Assert.
    expect(loadDraft(window.localStorage, 'conote:draft:x', NOW)).toEqual({
      ...CONTENT,
      savedAt: NOW.toISOString(),
    })
  })

  // Proves drafts older than 7 days are dropped without asking (FR-NTE-5).
  it('deletes a draft older than 7 days', () => {
    // Arrange.
    saveDraft(window.localStorage, 'conote:draft:x', CONTENT, NOW)
    const later = new Date(NOW.getTime() + DRAFT_MAX_AGE_MS + 1)

    // Assert.
    expect(loadDraft(window.localStorage, 'conote:draft:x', later)).toBeNull()
    expect(window.localStorage.getItem('conote:draft:x')).toBeNull()
  })

  // SECURITY: proves tampered or corrupt storage is discarded instead of loaded into the form.
  it.each(['not json', '{"title":1}', 'null'])('ignores a stored value of %j', (stored) => {
    // Arrange.
    window.localStorage.setItem('conote:draft:x', stored)

    // Assert.
    expect(loadDraft(window.localStorage, 'conote:draft:x', NOW)).toBeNull()
    expect(window.localStorage.getItem('conote:draft:x')).toBeNull()
  })

  // Proves blocked storage (some private modes) never breaks the editor.
  it('survives storage that throws', () => {
    // Arrange: a store whose every call throws.
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }

    // Assert.
    expect(() => {
      saveDraft(broken, 'k', CONTENT, NOW)
      removeDraft(broken, 'k')
    }).not.toThrow()
    expect(loadDraft(broken, 'k', NOW)).toBeNull()
  })

  // Proves removing deletes it.
  it('removes a draft', () => {
    // Arrange.
    saveDraft(window.localStorage, 'conote:draft:x', CONTENT, NOW)

    // Act.
    removeDraft(window.localStorage, 'conote:draft:x')

    // Assert.
    expect(loadDraft(window.localStorage, 'conote:draft:x', NOW)).toBeNull()
  })
})
