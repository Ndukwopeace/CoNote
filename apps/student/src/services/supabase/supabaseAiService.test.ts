/**
 * Tests for the Supabase Ask AI service: what it sends to the ask-ai function, and how each
 * answer becomes a reply or an error a screen already handles.
 */

// The client type, which these tests never reach: the function call is injected.
import type { SupabaseClient } from '@supabase/supabase-js'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The call helper's types.
import type { FunctionResult, InvokeFunction } from '@conote/supabase/functionCall'

// The unit under test.
import { createSupabaseAiService } from './supabaseAiService'

// IDs the tests use. They are version-4 UUIDs, which is what Supabase makes.
const COURSE = '20000000-0000-4000-8000-000000000001'
const CLASS = '30000000-0000-4000-8000-000000000001'

/** A message as the chat holds it. */
const message = (role: 'user' | 'assistant', content: string, id = 'm1') => ({
  id,
  role,
  content,
  createdAt: '2026-10-12T10:00:00.000Z',
})

/** A service whose function answers `result`. */
function setup(
  result: FunctionResult | Promise<FunctionResult> = { status: 200, body: { reply: 'Hi' } },
) {
  const invoke = vi.fn<InvokeFunction>(() => Promise.resolve(result))
  const service = createSupabaseAiService({ client: {} as SupabaseClient, invoke })
  return { service, invoke }
}

describe('createSupabaseAiService', () => {
  // Proves a real service is not labelled a preview (FR-AI-9).
  it('is not a preview', () => {
    expect(setup().service.isPreview).toBe(false)
  })

  // Proves the question goes to the function with only what it needs: no ids or times of messages.
  it('sends the scope and the conversation, without message ids or times', async () => {
    const { service, invoke } = setup()
    await expect(
      service.askAi({ scope: 'all' }, [
        message('user', 'What is a basis?', 'a'),
        message('assistant', 'A spanning set.', 'b'),
        message('user', 'And dimension?', 'c'),
      ]),
    ).resolves.toBe('Hi')
    expect(invoke).toHaveBeenCalledWith('ask-ai', {
      scope: 'all',
      messages: [
        { role: 'user', content: 'What is a basis?' },
        { role: 'assistant', content: 'A spanning set.' },
        { role: 'user', content: 'And dimension?' },
      ],
    })
  })

  // Proves a course or class question names only what the scope needs.
  it('names the course for a course question and the class for a class question', async () => {
    const course = setup()
    await course.service.askAi({ scope: 'course', courseId: COURSE }, [message('user', 'Hi')])
    expect(course.invoke).toHaveBeenCalledWith('ask-ai', {
      scope: 'course',
      courseId: COURSE,
      messages: [{ role: 'user', content: 'Hi' }],
    })
    const cls = setup()
    await cls.service.askAi({ scope: 'class', courseId: COURSE, classId: CLASS }, [
      message('user', 'Hi'),
    ])
    expect(cls.invoke).toHaveBeenCalledWith('ask-ai', {
      scope: 'class',
      classId: CLASS,
      messages: [{ role: 'user', content: 'Hi' }],
    })
  })

  // SECURITY: proves an id that is not a UUID never reaches the function.
  it('does not send an id that is not a UUID', async () => {
    const { service, invoke } = setup()
    await expect(
      service.askAi({ scope: 'course', courseId: '1; drop table' }, [message('user', 'Hi')]),
    ).rejects.toMatchObject({ kind: 'not_found' })
    await expect(
      service.askAi({ scope: 'class', classId: 'nope' }, [message('user', 'Hi')]),
    ).rejects.toMatchObject({ kind: 'not_found' })
    expect(invoke).not.toHaveBeenCalled()
  })

  // Proves the question must be last, as the mock requires, and nothing is sent without one.
  it('refuses a conversation that does not end with a question', async () => {
    const { service, invoke } = setup()
    await expect(service.askAi({ scope: 'all' }, [])).rejects.toMatchObject({
      kind: 'validation',
      message: 'Ask a question first.',
    })
    await expect(
      service.askAi({ scope: 'all' }, [message('assistant', 'Hello')]),
    ).rejects.toMatchObject({ kind: 'validation' })
    expect(invoke).not.toHaveBeenCalled()
  })

  // Proves a long conversation is cut to the function's limits, so it is never refused for length.
  it('keeps only the latest 20 messages, each at most 2000 characters', async () => {
    const { service, invoke } = setup()
    const long = Array.from({ length: 30 }, (_, index) =>
      message(index % 2 === 1 ? 'user' : 'assistant', 'x'.repeat(2500), String(index)),
    )
    await service.askAi({ scope: 'all' }, long)
    const body = invoke.mock.calls[0]?.[1] as { messages: { content: string }[] }
    expect(body.messages).toHaveLength(20)
    expect(body.messages.every((sent) => sent.content.length === 2000)).toBe(true)
  })

  // Proves each refusal becomes the error a screen handles, in the function's own words.
  it.each([
    [404, { kind: 'not_found', message: 'We couldn’t find that.' }, 'not_found'],
    [403, { kind: 'forbidden', message: 'You do not have access to this.' }, 'forbidden'],
    [401, { kind: 'unauthorized', message: 'Sign in again to continue.' }, 'unauthorized'],
    [429, { kind: 'rate_limited', message: 'Limit reached.' }, 'validation'],
    [502, { kind: 'unknown', message: 'Ask AI could not answer right now.' }, 'unknown'],
  ])('turns a %i answer into an error of kind %s', async (status, error, kind) => {
    const { service } = setup({ status, body: { error } })
    await expect(service.askAi({ scope: 'all' }, [message('user', 'Hi')])).rejects.toMatchObject({
      kind,
      message: error.message,
    })
  })

  // SECURITY: proves an answer of the wrong shape is never shown as a reply.
  it('refuses an answer that is not a reply', async () => {
    for (const body of [{}, { reply: 3 }, { reply: '' }, null]) {
      const { service } = setup({ status: 200, body })
      await expect(service.askAi({ scope: 'all' }, [message('user', 'Hi')])).rejects.toMatchObject({
        kind: 'unknown',
      })
    }
  })
})
