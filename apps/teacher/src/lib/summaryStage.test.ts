/**
 * Tests for the stage wording and the edit rule.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { isEditable, stageLabel } from './summaryStage'

describe('stageLabel', () => {
  // Proves each stage reads as the spec's table says.
  it('words each stage', () => {
    expect(stageLabel('collecting')).toBe('Collecting notes')
    expect(stageLabel('processing')).toBe('AI is drafting')
    expect(stageLabel('in_review')).toBe('Ready for your review')
    expect(stageLabel('published')).toBe('Published')
  })
})

describe('isEditable', () => {
  // Proves only a summary in review can be edited.
  it('allows editing only in review', () => {
    expect(isEditable('in_review')).toBe(true)
    expect(isEditable('collecting')).toBe(false)
    expect(isEditable('processing')).toBe(false)
    expect(isEditable('published')).toBe(false)
  })
})
