/**
 * Tests for the summary state card wording (REQUIREMENTS.md section 4).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test.
import { summaryStateMessage } from './summaryState'

describe('summaryStateMessage', () => {
  // Proves each state's wording matches the requirements table: [state, title, message].
  it.each([
    ['collecting', 'Summary not available yet', 'Add your notes to contribute.'],
    ['processing', 'Summary in progress', 'CoNote AI is analysing class notes.'],
    ['in_review', 'Summary in review', 'Your teacher is reviewing the summary.'],
    ['published', 'Summary available', 'Your teacher has approved the summary for this class.'],
  ] as const)('%s', (state, title, message) => {
    expect(summaryStateMessage(state)).toEqual({ title, message })
  })
})
