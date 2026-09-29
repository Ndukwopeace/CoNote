/**
 * Tests for the demo AI service (FR-AI-6).
 */

// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The demo replies.
import { cannedReply, suggestedPrompts } from '@/lib/aiReplies'

// The unit under test.
import { AI_DELAY_MS, createMockAiService } from './mockAiService'

/** A one-message conversation. */
function ask(text: string) {
  return [{ id: 'm1', role: 'user' as const, content: text, createdAt: '2026-09-28T09:00:00Z' }]
}

// Real timers after the timing test.
afterEach(() => {
  vi.useRealTimers()
})

describe('mock AI service', () => {
  // Proves a suggested prompt gets its prepared reply.
  it('answers the last user message', async () => {
    // Arrange.
    const [prompt = ''] = suggestedPrompts({ scope: 'all' })
    const ai = createMockAiService({ delay: () => 0 })

    // Assert.
    await expect(ai.askAi({ scope: 'all' }, ask(prompt))).resolves.toBe(cannedReply(prompt))
  })

  // Proves the reply takes 600–1200 ms, as a real model would take a moment (FR-AI-6).
  it('waits between 600 and 1200 ms', async () => {
    // Arrange: the shortest and longest delays.
    vi.useFakeTimers()
    const fast = createMockAiService({ random: () => 0 })
    const slow = createMockAiService({ random: () => 0.9999 })
    let fastDone = false
    let slowDone = false
    void fast.askAi({ scope: 'all' }, ask('x')).then(() => (fastDone = true))
    void slow.askAi({ scope: 'all' }, ask('x')).then(() => (slowDone = true))

    // Act and assert.
    await vi.advanceTimersByTimeAsync(AI_DELAY_MS.min - 1)
    expect(fastDone).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(fastDone).toBe(true)
    await vi.advanceTimersByTimeAsync(AI_DELAY_MS.max - AI_DELAY_MS.min)
    expect(slowDone).toBe(true)
  })

  // Proves a conversation must end with the student's question.
  it('rejects a conversation without a question', async () => {
    await expect(
      createMockAiService({ delay: () => 0 }).askAi({ scope: 'all' }, []),
    ).rejects.toMatchObject({
      kind: 'validation',
    })
  })
})
