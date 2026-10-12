/**
 * Tests for the one place the language model is called: what is sent, and how each kind of
 * refusal is told apart.
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The unit under test.
import { askModel } from './model.ts'
import { PipelineError } from './summaryDraft.ts'

/** The settings every call uses. */
const SETTINGS = { apiKey: 'key-123', model: 'some/model' }

/** A model answer in the usual shape. */
const answer = (content: unknown) =>
  Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content } }] })))

/** What a call sent, read back from the fetch double. */
function sentBy(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return {
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string) as Record<string, unknown>,
  }
}

describe('askModel', () => {
  // Proves the key goes to the model's own address only, and the model and messages are sent.
  it('sends the model, the messages and the key to the model’s address', async () => {
    const fetchMock = vi.fn(() => answer('hello'))
    const reply = await askModel(
      { ...SETTINGS, fetch: fetchMock },
      [{ role: 'user', content: 'Hi' }],
      { json: false, maxTokens: 700 },
    )
    expect(reply).toBe('hello')
    const sent = sentBy(fetchMock)
    expect(sent.url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(sent.headers.Authorization).toBe('Bearer key-123')
    expect(sent.body).toMatchObject({
      model: 'some/model',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 700,
    })
  })

  // Proves JSON mode is asked for only when the caller wants JSON, so a chat reply is plain text.
  it('asks for JSON only when told to', async () => {
    const asJson = vi.fn(() => answer('{}'))
    await askModel({ ...SETTINGS, fetch: asJson }, [], {
      json: true,
      maxTokens: 100,
    })
    expect(sentBy(asJson).body.response_format).toEqual({ type: 'json_object' })
    const asText = vi.fn(() => answer('text'))
    await askModel({ ...SETTINGS, fetch: asText }, [], {
      json: false,
      maxTokens: 100,
    })
    expect(sentBy(asText).body).not.toHaveProperty('response_format')
  })

  // Proves each kind of refusal gets its own code, with a fixed message and no raw text.
  it.each([
    [429, 'model_busy'],
    [401, 'model_key'],
    [403, 'model_key'],
  ])('tells a %i answer apart as %s', async (status, code) => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status })))
    await expect(
      askModel({ ...SETTINGS, fetch: fetchMock }, [], {
        json: false,
        maxTokens: 10,
      }),
    ).rejects.toMatchObject({ code })
  })

  // Proves another error carries the model's status and explanation, which describe the request
  // and never a note.
  it('records the status and explanation of another error', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ error: { code: 'model_not_found', message: 'No such model.' } }),
          {
            status: 404,
          },
        ),
      ),
    )
    const failure = await askModel({ ...SETTINGS, fetch: fetchMock }, [], {
      json: false,
      maxTokens: 10,
    }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(PipelineError)
    expect(failure).toMatchObject({ code: 'model_rejected' })
    expect((failure as Error).message).toContain('404')
    expect((failure as Error).message).toContain('model_not_found: No such model.')
  })

  // Proves an answer that says the request itself is wrong (a bad setting, a model that does not
  // exist) is told apart from a failure on the model's side: the first cannot be fixed by waiting,
  // so it has its own code and is never retried; the second can, so it keeps the general one.
  it.each([
    [400, 'model_rejected'],
    [404, 'model_rejected'],
    [413, 'model_rejected'],
    [422, 'model_rejected'],
    [500, 'model_error'],
    [502, 'model_error'],
    [503, 'model_error'],
  ])('tells a %i answer apart as %s', async (status, code) => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status })))
    await expect(
      askModel({ ...SETTINGS, fetch: fetchMock }, [], {
        json: false,
        maxTokens: 10,
      }),
    ).rejects.toMatchObject({ code })
  })

  // Proves a dropped connection and an answer with no text are told apart from a refusal.
  it('reports an unreachable model and an answer with no text', async () => {
    const down = vi.fn(() => Promise.reject(new Error('offline')))
    await expect(
      askModel({ ...SETTINGS, fetch: down }, [], {
        json: false,
        maxTokens: 10,
      }),
    ).rejects.toMatchObject({ code: 'model_unreachable' })
    const empty = vi.fn(() => answer(undefined))
    await expect(
      askModel({ ...SETTINGS, fetch: empty }, [], {
        json: false,
        maxTokens: 10,
      }),
    ).rejects.toMatchObject({ code: 'bad_output' })
  })
})
