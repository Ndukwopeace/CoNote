/**
 * Tests for the summary pipeline's worker: who may start a run, what is sent to the model, how
 * each kind of failure is recorded, and that nothing but the notes' text reaches the model.
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The table double and the helper that asks what a query did.
import {
  createFakeTables,
  made,
  type RecordedQuery,
  type TableAnswer,
} from '@conote/testing/fakeTables'

// The unit under test.
import { processJobsHandler } from './processJobs.ts'
import { readPipelineEnv } from './env.ts'
import { NOW } from '../testSupport.ts'

// A job as `claim_ai_job` returns it.
const JOB = {
  job_id: '40000000-0000-4000-8000-000000000001',
  class_id: '50000000-0000-4000-8000-000000000001',
  attempt: 1,
  class_title: 'Eigenvalues',
  course_title: 'Linear Algebra',
}

/** The settings, as the function reads them. */
const PIPELINE = readPipelineEnv(
  (name) => ({ GROQ_API_KEY: 'groq-key', PIPELINE_TOKEN: 'run-token' })[name],
)

/** A model answer in the shape the handler reads. */
const modelAnswer = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

/** A draft the model might write. */
const DRAFT = JSON.stringify({
  overview: 'The class covered eigenvalues.',
  keyConcepts: [{ title: 'Eigenvalue', explanation: 'A scalar.' }],
})

/** A request with a bearer token. */
const run = (token: string | null = 'run-token', method = 'POST') =>
  new Request('https://project.supabase.co/functions/v1/process-ai-jobs', {
    method,
    headers: token === null ? {} : { Authorization: `Bearer ${token}` },
  })

interface Setup {
  // What `claim_ai_job` returns, one entry per claim.
  claims?: unknown[][]
  notes?: TableAnswer
  fail?: TableAnswer
  finish?: TableAnswer
  queue?: TableAnswer
  fetchImpl?: () => Promise<Response>
}

/** A handler over fakes, and the handles to check what happened. */
function build({ claims = [[JOB], []], notes, fail, finish, queue, fetchImpl }: Setup = {}) {
  const remaining = [...claims]
  const answer = (query: RecordedQuery): TableAnswer => {
    if (query.table === 'rpc:queue_summary_jobs') return queue ?? { data: 1, error: null }
    if (query.table === 'rpc:claim_ai_job') return { data: remaining.shift() ?? [], error: null }
    if (query.table === 'rpc:finish_ai_job') return finish ?? { data: null, error: null }
    if (query.table === 'rpc:fail_ai_job') return fail ?? { data: 'failed', error: null }
    return (
      notes ?? {
        data: [{ title: 'Week 4', content_html: '<p>Eigenvalues scale vectors.</p>' }],
        error: null,
      }
    )
  }
  const tables = createFakeTables(answer)
  const fetchMock = vi.fn<typeof fetch>(fetchImpl ?? (() => Promise.resolve(modelAnswer(DRAFT))))
  let n = 0
  const handler = processJobsHandler({
    clients: { service: tables.client },
    env: PIPELINE,
    now: () => NOW,
    fetch: fetchMock,
    newId: () => `item-${String((n += 1))}`,
  })
  const calls = (name: string) => tables.queries.filter((query) => query.table === `rpc:${name}`)
  return { handler, fetchMock, queries: tables.queries, calls }
}

/** The arguments of the first call to the function `name`. */
function argsOf(calls: RecordedQuery[]): Record<string, unknown> {
  const call = calls[0]?.calls[0]
  return (call?.[1] ?? {}) as Record<string, unknown>
}

describe('who may start a run', () => {
  // SECURITY: proves a missing, wrong or near-miss token is refused before anything is done.
  it.each([[null], ['wrong'], ['run-toke'], ['run-token-and-more']])(
    'refuses the token %s',
    async (token) => {
      const { handler, queries, fetchMock } = build()
      const response = await handler(run(token))
      expect(response.status).toBe(401)
      expect(queries).toHaveLength(0)
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  // Proves only POST is accepted.
  it('refuses other methods', async () => {
    const { handler } = build()
    expect((await handler(run('run-token', 'GET'))).status).toBe(400)
  })
})

describe('a run', () => {
  // Proves the happy path: queue, claim, read notes, ask the model, store the draft.
  it('writes a draft for a queued job', async () => {
    const { handler, calls, fetchMock } = build()
    const response = await handler(run())
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      queued: 1,
      succeeded: 1,
      retried: 0,
      failed: 0,
    })
    expect(argsOf(calls('finish_ai_job'))).toEqual({
      p_job: JOB.job_id,
      p_overview: 'The class covered eigenvalues.',
      p_key_concepts: [{ id: 'item-1', title: 'Eigenvalue', explanation: 'A scalar.' }],
      p_confusion_areas: [],
      p_key_topics: [],
      p_now: NOW.toISOString(),
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // PRIVACY: proves what is sent to the model and where: the key to the model's own address, the
  // notes' text and titles, and no student ID.
  it('sends only the notes text and titles to the model', async () => {
    const { handler, fetchMock, queries } = build()
    await handler(run())
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer groq-key')
    const body = JSON.parse(init?.body as string) as {
      model: string
      response_format: unknown
      messages: { content: string }[]
    }
    expect(body.model).toBe('llama-3.3-70b-versatile')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[1]?.content).toBe(
      'Course: Linear Algebra\nClass: Eigenvalues\n\nNotes:\n\nNote 1 (Week 4):\nEigenvalues scale vectors.',
    )
    // The notes are read without any student ID column.
    const [read] = queries.filter((query) => query.table === 'notes')
    expect(read && made(read, 'select', 'title, content_html')).toBe(true)
  })

  // Proves a run with nothing to do ends quietly, and the number queued is reported.
  it('ends when there is no job', async () => {
    const { handler, fetchMock } = build({ claims: [[]], queue: { data: 0, error: null } })
    await expect((await handler(run())).json()).resolves.toEqual({
      queued: 0,
      succeeded: 0,
      retried: 0,
      failed: 0,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Proves one run takes on at most three jobs, so it ends inside the platform's time limit.
  it('takes at most three jobs per run', async () => {
    const { handler, calls } = build({ claims: [[JOB], [JOB], [JOB], [JOB], []] })
    const body = (await (await handler(run())).json()) as { succeeded: number }
    expect(body.succeeded).toBe(3)
    expect(calls('claim_ai_job')).toHaveLength(3)
  })

  // Proves a failure to queue or claim stops the run with an error, not a silent success.
  it('stops with an error when the database refuses', async () => {
    const queueDown = build({ queue: { data: null, error: { code: 'XX000', message: 'x' } } })
    expect((await queueDown.handler(run())).status).toBe(502)
    const claimDown = processJobsHandler({
      clients: {
        service: createFakeTables((query) =>
          query.table === 'rpc:claim_ai_job'
            ? { data: null, error: { code: 'XX000', message: 'x' } }
            : { data: 0, error: null },
        ).client,
      },
      env: PIPELINE,
      now: () => NOW,
      fetch: vi.fn<typeof fetch>(),
      newId: () => 'x',
    })
    expect((await claimDown(run())).status).toBe(502)
  })
})

describe('failures', () => {
  /** The failure recorded for a run set up with `setup`. */
  async function recorded(setup: Setup) {
    const { handler, calls } = build(setup)
    const body = (await (await handler(run())).json()) as Record<string, number>
    return { args: argsOf(calls('fail_ai_job')), body, calls }
  }

  // Proves each kind of model failure is recorded under its own code, with safe text.
  it.each([
    ['rate limit', () => Promise.resolve(new Response('{}', { status: 429 })), 'model_busy'],
    ['refused key', () => Promise.resolve(new Response('{}', { status: 401 })), 'model_key'],
    ['forbidden key', () => Promise.resolve(new Response('{}', { status: 403 })), 'model_key'],
    ['server error', () => Promise.resolve(new Response('boom', { status: 500 })), 'model_error'],
    ['network failure', () => Promise.reject(new Error('offline')), 'model_unreachable'],
    [
      'no text',
      () => Promise.resolve(new Response(JSON.stringify({ choices: [] }), { status: 200 })),
      'bad_output',
    ],
    [
      'unreadable body',
      () => Promise.resolve(new Response('not json', { status: 200 })),
      'bad_output',
    ],
    ['non-JSON text', () => Promise.resolve(modelAnswer('I cannot help.')), 'bad_output'],
  ])('records a %s as %s', async (_name, fetchImpl, code) => {
    const { args, body } = await recorded({ fetchImpl })
    expect(args).toMatchObject({ p_job: JOB.job_id, p_code: code, p_max_attempts: 3 })
    expect(String(args.p_message)).not.toContain('boom')
    expect(body).toMatchObject({ succeeded: 0, failed: 1 })
  })

  // Proves a job the database will try again is counted as retried, not failed.
  it('counts a job that goes back in the queue as retried', async () => {
    const { body } = await recorded({
      fail: { data: 'queued', error: null },
      fetchImpl: () => Promise.resolve(new Response('{}', { status: 429 })),
    })
    expect(body).toMatchObject({ retried: 1, failed: 0 })
  })

  // Proves a class whose notes have no text fails without asking the model.
  it('fails a class with no usable notes without calling the model', async () => {
    const { handler, calls, fetchMock } = build({
      notes: { data: [{ title: null, content_html: '<p></p>' }], error: null },
    })
    await handler(run())
    expect(argsOf(calls('fail_ai_job'))).toMatchObject({ p_code: 'no_notes' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Proves unreadable notes and a refused save are recorded as database failures.
  it('records a database failure when notes cannot be read or the draft cannot be saved', async () => {
    const reading = await recorded({
      notes: { data: null, error: { code: 'XX000', message: 'x' } },
    })
    expect(reading.args).toMatchObject({ p_code: 'database' })
    const saving = await recorded({
      finish: { data: null, error: { code: '22023', message: 'bad' } },
    })
    expect(saving.args).toMatchObject({ p_code: 'database' })
  })

  // Proves any other error is recorded with a message that says nothing about the cause.
  it('records an unexpected error without its details', async () => {
    const { handler, calls } = build({
      fetchImpl: () => {
        throw new TypeError('secret detail')
      },
    })
    await handler(run())
    const args = argsOf(calls('fail_ai_job'))
    expect(args.p_code).toBe('model_unreachable')
    expect(JSON.stringify(args)).not.toContain('secret detail')
  })
})
