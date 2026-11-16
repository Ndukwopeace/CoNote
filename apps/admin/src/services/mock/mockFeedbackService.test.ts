/**
 * Tests for the demo AdminFeedbackService (D125): the shared contract, plus the parts only the demo
 * has: the sender comes from the session, and what was sent is saved.
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The records.
import { emptyPlatformData, userRecord } from '../platformData'
// The shared rules.
import { describeFeedbackServiceContract } from '../contracts/feedbackService.contract'

// The unit under test.
import { createMockFeedbackService } from './mockFeedbackService'

describeFeedbackServiceContract(
  'mock',
  (data, now) =>
    createMockFeedbackService({ data, now: () => now, actorId: () => 'a1', latencyMs: 0 }),
  () => emptyPlatformData({ users: [userRecord({ id: 'a1', role: 'admin', fullName: 'Amara' })] }),
)

describe('mock Feedback service', () => {
  // SECURITY: proves nobody signed in cannot send feedback, and the sender is the session's.
  it('refuses a send with no session', async () => {
    const service = createMockFeedbackService({
      data: emptyPlatformData(),
      now: () => new Date(),
      actorId: () => null,
      latencyMs: 0,
    })

    await expect(
      service.send({ kind: 'bug', message: 'Hello', rating: null, page: '' }),
    ).rejects.toMatchObject({ kind: 'unauthorized' })
  })

  // Proves the sender's name and email are read from the accounts, and a change is saved.
  it('shows who sent it and saves after a change', async () => {
    const onChange = vi.fn()
    const data = emptyPlatformData({
      users: [userRecord({ id: 'a1', role: 'admin', fullName: 'Amara', email: 'amara@x.example' })],
    })
    const service = createMockFeedbackService({
      data,
      now: () => new Date(),
      actorId: () => 'a1',
      latencyMs: 0,
      onChange,
    })

    await service.send({ kind: 'idea', message: 'Hello', rating: null, page: '/x' })
    const { items } = await service.listFeedback({})

    expect(items[0]).toMatchObject({ senderName: 'Amara', senderEmail: 'amara@x.example' })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  // Proves a sender whose account was deleted is listed without a name.
  it('lists feedback from a deleted account without a name', async () => {
    const data = emptyPlatformData({
      feedback: [
        {
          id: 'f1',
          userId: null,
          role: 'student',
          kind: 'bug',
          message: 'Left a note',
          rating: null,
          page: null,
          status: 'new',
          createdAt: '2026-10-01T10:00:00.000Z',
        },
      ],
    })
    const service = createMockFeedbackService({
      data,
      now: () => new Date(),
      actorId: () => 'a1',
      latencyMs: 0,
    })

    const { items } = await service.listFeedback({})

    expect(items[0]).toMatchObject({ senderName: null, senderEmail: null, senderRole: 'student' })
  })
})
