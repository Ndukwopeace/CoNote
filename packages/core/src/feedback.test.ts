/**
 * Tests for the feedback rules (D125): what can be sent, and which page is recorded.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { FEEDBACK_MAX_LENGTH, createDemoFeedbackService, feedbackProblem, pageOf } from './feedback'

describe('feedbackProblem', () => {
  // Proves an empty message, or only spaces, is turned away with words the sender can use.
  it('asks for a message when there is none', () => {
    expect(feedbackProblem({ message: '' })).toBe('Write a message before you send.')
    expect(feedbackProblem({ message: '   \n ' })).toBe('Write a message before you send.')
  })

  // Proves the limit is the database's: the longest message passes, one more does not.
  it('allows the longest message and turns away one more', () => {
    expect(feedbackProblem({ message: 'x'.repeat(FEEDBACK_MAX_LENGTH) })).toBeNull()
    expect(feedbackProblem({ message: 'x'.repeat(FEEDBACK_MAX_LENGTH + 1) })).toMatch(/under 2000/)
  })

  // Proves spaces around a message are not counted against the limit.
  it('does not count spaces at the ends', () => {
    expect(feedbackProblem({ message: `  ${'x'.repeat(FEEDBACK_MAX_LENGTH)}  ` })).toBeNull()
  })
})

describe('pageOf', () => {
  // SECURITY: proves a query or hash, which can hold a token or a name, is never recorded.
  it('drops the query and the hash', () => {
    expect(pageOf('/dashboard?write=1&classId=abc#top')).toBe('/dashboard')
    expect(pageOf('/admin/reset-password#access_token=secret')).toBe('/admin/reset-password')
  })

  // Proves a long path is cut to what the database keeps.
  it('cuts a path to 200 characters', () => {
    expect(pageOf(`/${'a'.repeat(300)}`)).toHaveLength(200)
  })
})

describe('createDemoFeedbackService', () => {
  // Proves the demo accepts a usable message and refuses an empty one, like the real service.
  it('accepts a message and refuses an empty one', async () => {
    const service = createDemoFeedbackService(0)

    await expect(
      service.send({ kind: 'idea', message: 'Hello', rating: null, page: '/x' }),
    ).resolves.toBeUndefined()
    await expect(
      service.send({ kind: 'idea', message: ' ', rating: null, page: '/x' }),
    ).rejects.toMatchObject({ kind: 'validation' })
  })
})
