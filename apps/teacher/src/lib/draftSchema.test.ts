/**
 * Tests for the summary draft's rules.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { DRAFT_LIMITS, draftSchema, emptyDraft } from './draftSchema'

/** A valid draft to change one thing in. */
const VALID = {
  overview: 'Vectors and spaces.',
  keyConcepts: [{ id: 'c1', title: 'Basis', explanation: 'A minimal spanning set.' }],
  confusionAreas: [{ id: 'f1', issue: 'Span vs basis', clarification: 'A basis is independent.' }],
  keyTopics: [{ id: 't1', name: 'Rank', description: '' }],
}

describe('draftSchema', () => {
  // Proves a complete draft passes, and text is trimmed on the way through.
  it('accepts a complete draft and trims its text', () => {
    const parsed = draftSchema.parse({ ...VALID, overview: '  Vectors.  ' })
    expect(parsed.overview).toBe('Vectors.')
  })

  // Proves lists may be empty: a class may have no confusion areas, say.
  it('accepts empty lists', () => {
    expect(draftSchema.safeParse({ ...VALID, keyConcepts: [], keyTopics: [] }).success).toBe(true)
  })

  // Proves the one optional field may be blank.
  it('allows a blank topic description', () => {
    expect(draftSchema.safeParse(VALID).success).toBe(true)
  })

  // Proves a blank required field blocks saving and names the field in its message.
  it.each([
    ['overview', { ...VALID, overview: '   ' }, 'Enter the overview.'],
    [
      'concept title',
      { ...VALID, keyConcepts: [{ id: 'c1', title: '', explanation: 'x' }] },
      'Enter the concept title.',
    ],
    [
      'concept explanation',
      { ...VALID, keyConcepts: [{ id: 'c1', title: 'x', explanation: ' ' }] },
      'Enter the concept explanation.',
    ],
    [
      'point of confusion',
      { ...VALID, confusionAreas: [{ id: 'f1', issue: '', clarification: 'x' }] },
      'Enter the point of confusion.',
    ],
    [
      'clarification',
      { ...VALID, confusionAreas: [{ id: 'f1', issue: 'x', clarification: '' }] },
      'Enter the clarification.',
    ],
    [
      'topic name',
      { ...VALID, keyTopics: [{ id: 't1', name: '', description: '' }] },
      'Enter the topic name.',
    ],
  ])('rejects a blank %s', (_field, draft, message) => {
    const result = draftSchema.safeParse(draft)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(message)
  })

  // Proves over-long text and too many items are refused, so a draft can't grow without limit.
  it('enforces the limits', () => {
    expect(
      draftSchema.safeParse({ ...VALID, overview: 'x'.repeat(DRAFT_LIMITS.overview + 1) }).success,
    ).toBe(false)
    const many = Array.from({ length: DRAFT_LIMITS.items + 1 }, (_, n) => ({
      id: String(n),
      name: 'Topic',
      description: '',
    }))
    expect(draftSchema.safeParse({ ...VALID, keyTopics: many }).success).toBe(false)
  })

  // Proves an empty draft is empty, and is not itself valid (the overview is required).
  it('has an empty draft that is not yet valid', () => {
    expect(emptyDraft()).toEqual({
      overview: '',
      keyConcepts: [],
      confusionAreas: [],
      keyTopics: [],
    })
    expect(draftSchema.safeParse(emptyDraft()).success).toBe(false)
  })
})
