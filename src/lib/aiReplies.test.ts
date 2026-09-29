/**
 * Tests for the demo AI's suggested prompts and canned replies (FR-AI-1, FR-AI-6).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { cannedReply, suggestedPrompts } from './aiReplies'

describe('suggestedPrompts', () => {
  // Proves three prompts, worded for the chosen context.
  it.each([
    [{ scope: 'all' } as const, /my courses/i],
    [{ scope: 'course', courseId: 'swe-311' } as const, /this course/i],
    [{ scope: 'class', courseId: 'swe-311', classId: 'swe-311-c2' } as const, /this class/i],
  ])('gives three prompts for %j', (context, wording) => {
    const prompts = suggestedPrompts(context)
    expect(prompts).toHaveLength(3)
    expect(prompts.some((p) => wording.test(p))).toBe(true)
  })
})

describe('cannedReply', () => {
  // Proves each suggested prompt has its own reply.
  it('answers every suggested prompt with a specific reply', () => {
    // Every prompt for every scope.
    const prompts = [
      ...suggestedPrompts({ scope: 'all' }),
      ...suggestedPrompts({ scope: 'course', courseId: 'c' }),
      ...suggestedPrompts({ scope: 'class', courseId: 'c', classId: 'k' }),
    ]
    // The generic fallback, for comparison.
    const fallback = cannedReply('something unrelated')
    for (const prompt of prompts) expect(cannedReply(prompt)).not.toBe(fallback)
  })

  // Proves case and spacing don't matter for matching.
  it('matches prompts loosely', () => {
    const [prompt = ''] = suggestedPrompts({ scope: 'all' })
    expect(cannedReply(`  ${prompt.toUpperCase()} `)).toBe(cannedReply(prompt))
  })

  // Proves any other question gets the generic reply (FR-AI-6).
  it('falls back to a generic reply', () => {
    expect(cannedReply('What is the capital of France?')).toMatch(/demo/i)
  })
})
