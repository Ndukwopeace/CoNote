/**
 * Tests for sending feedback on Supabase (D125): what is sent to the database function, that an
 * unusable message never leaves, and that a refusal becomes an error the form can show.
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// The unit under test.
import { createSupabaseFeedbackService } from './feedback'

/** A client whose `rpc` answers with `error`; the calls are kept in `rpc.mock.calls`. */
function clientAnswering(error: unknown = null) {
  const rpc = vi.fn<(name: string, args?: Record<string, unknown>) => Promise<{ error: unknown }>>(
    () => Promise.resolve({ error }),
  )
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

const INPUT = { kind: 'idea', message: 'Dark mode, please', rating: 5, page: '/dashboard' } as const

describe('createSupabaseFeedbackService', () => {
  // Proves the four fields are sent as the function's arguments, and nothing about the sender.
  it('sends the feedback to the database function', async () => {
    const { client, rpc } = clientAnswering()

    await createSupabaseFeedbackService({ client }).send(INPUT)

    expect(rpc).toHaveBeenCalledWith('submit_feedback', {
      p_kind: 'idea',
      p_message: 'Dark mode, please',
      p_rating: 5,
      p_page: '/dashboard',
    })
  })

  // Proves no rating is sent as null, not as zero.
  it('sends a missing rating as null', async () => {
    const { client, rpc } = clientAnswering()

    await createSupabaseFeedbackService({ client }).send({ ...INPUT, rating: null })

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_rating: null })
  })

  // Proves an empty message is refused before any call.
  it('turns an empty message away without calling', async () => {
    const { client, rpc } = clientAnswering()

    await expect(
      createSupabaseFeedbackService({ client }).send({ ...INPUT, message: '  ' }),
    ).rejects.toMatchObject({ kind: 'validation' })
    expect(rpc).not.toHaveBeenCalled()
  })

  // Proves the daily limit and a refusal reach the form as errors it can word.
  it('reports the daily limit and a refusal', async () => {
    const limited = clientAnswering({ code: '54000', message: 'too much feedback' })
    await expect(
      createSupabaseFeedbackService({ client: limited.client }).send(INPUT),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'You have sent a lot of feedback today. Try again tomorrow.',
    })

    const refused = clientAnswering({ code: '42501', message: 'forbidden' })
    await expect(
      createSupabaseFeedbackService({ client: refused.client }).send(INPUT),
    ).rejects.toMatchObject({ kind: 'forbidden' })
  })
})
