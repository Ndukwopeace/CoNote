/**
 * Tests for Ask AI: who may ask, what the model is shown (only the asking student's own notes and
 * the teacher-approved summaries of their own courses), the daily limit, and each way it can fail.
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
import { askAiHandler } from './askAi.ts'
import { ENV, NOW, bodyOf, post } from '../testSupport.ts'

// IDs the tests use. They are version-4 UUIDs, which is what Supabase makes.
const STUDENT = '66666666-6666-4666-8666-666666666666'
const COURSE = '20000000-0000-4000-8000-000000000001'
const OTHER_COURSE = '20000000-0000-4000-8000-000000000002'
const CLASS = '30000000-0000-4000-8000-000000000001'
const OTHER_CLASS = '30000000-0000-4000-8000-000000000002'

/** A conversation that ends with a question. */
const ASK = {
  scope: 'all',
  messages: [{ role: 'user', content: 'What is a basis?' }],
}

/** A model answer in the shape the function reads. */
const modelAnswer = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

interface Setup {
  // The caller's profile row.
  profile?: unknown
  enrollments?: TableAnswer
  summaries?: TableAnswer
  notes?: TableAnswer
  classes?: TableAnswer
  // What `take_chat_slot` answers.
  slot?: TableAnswer
  fetchImpl?: () => Promise<Response>
  // Who the token belongs to (null: nobody).
  caller?: string | null
}

/** A handler over fakes, and the handles to check what happened. */
function build({
  profile = { role: 'student', status: 'active' },
  enrollments,
  summaries,
  notes,
  classes,
  slot,
  fetchImpl,
  caller = STUDENT,
}: Setup = {}) {
  const answer = (query: RecordedQuery): TableAnswer => {
    switch (query.table) {
      case 'profiles':
        return { data: profile, error: null }
      case 'enrollments':
        return enrollments ?? { data: [{ course_id: COURSE }], error: null }
      case 'courses':
        return { data: [{ id: COURSE, code: 'MTH 202', title: 'Linear Algebra' }], error: null }
      case 'class_sessions':
        return (
          classes ?? {
            data: [{ id: CLASS, course_id: COURSE, number: 4, title: 'Basis and dimension' }],
            error: null,
          }
        )
      case 'summaries':
        return (
          summaries ?? {
            data: [
              {
                class_id: CLASS,
                course_id: COURSE,
                overview: 'The class covered bases.',
                key_concepts: [
                  { id: 'c1', title: 'Basis', explanation: 'A minimal spanning set.' },
                ],
                confusion_areas: [],
                key_topics: [],
              },
            ],
            error: null,
          }
        )
      case 'notes':
        return (
          notes ?? {
            data: [{ class_id: CLASS, title: 'My note', content_html: '<p>Bases span.</p>' }],
            error: null,
          }
        )
      case 'rpc:take_chat_slot':
        return slot ?? { data: true, error: null }
      default:
        return { data: null, error: null }
    }
  }
  const tables = createFakeTables(answer)
  const fetchMock = vi.fn<typeof fetch>(
    fetchImpl ?? (() => Promise.resolve(modelAnswer('A basis is a minimal spanning set.'))),
  )
  const handler = askAiHandler({
    env: ENV,
    clients: {
      service: tables.client,
      anon: tables.client,
      callerId: () => Promise.resolve(caller),
    },
    now: () => NOW,
    model: { fetch: fetchMock, apiKey: 'groq-key', model: 'some/model' },
    dailyLimit: 30,
  })
  const calls = (name: string) => tables.queries.filter((query) => query.table === `rpc:${name}`)
  const against = (table: string) => tables.queries.filter((query) => query.table === table)
  return { handler, fetchMock, queries: tables.queries, calls, against }
}

/** The messages the model was sent. */
function sentToModel(fetchMock: ReturnType<typeof build>['fetchMock']) {
  const init = fetchMock.mock.calls[0]?.[1]
  const body = JSON.parse(init?.body as string) as { messages: { role: string; content: string }[] }
  return body.messages
}

describe('who may ask', () => {
  // Proves a missing or invalid sign-in is refused before anything is read or sent.
  it('refuses a request without a valid sign-in', async () => {
    const none = build()
    expect((await none.handler(post(ASK, null))).status).toBe(401)
    const stranger = build({ caller: null })
    expect((await stranger.handler(post(ASK))).status).toBe(401)
    for (const { queries, fetchMock } of [none, stranger]) {
      expect(fetchMock).not.toHaveBeenCalled()
      expect(queries.filter((query) => query.table !== 'profiles')).toHaveLength(0)
    }
  })

  // SECURITY: proves only an active student may ask, so a teacher, an administrator or a
  // suspended student gets 403 whatever they send.
  it.each([
    [{ role: 'teacher', status: 'active' }],
    [{ role: 'admin', status: 'active' }],
    [{ role: 'student', status: 'suspended' }],
    [null],
  ])('refuses the account %j', async (profile) => {
    const { handler, fetchMock, calls } = build({ profile })
    expect((await handler(post(ASK))).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(calls('take_chat_slot')).toHaveLength(0)
  })
})

describe('what may be asked', () => {
  // Proves bad input is refused before anything is read or sent.
  it.each([
    ['no messages', { scope: 'all', messages: [] }],
    [
      'an assistant message last',
      {
        scope: 'all',
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
        ],
      },
    ],
    ['a blank question', { scope: 'all', messages: [{ role: 'user', content: '   ' }] }],
    [
      'a question that is too long',
      { scope: 'all', messages: [{ role: 'user', content: 'x'.repeat(2001) }] },
    ],
    [
      'too many messages',
      {
        scope: 'all',
        messages: Array.from({ length: 21 }, () => ({ role: 'user', content: 'Hi' })),
      },
    ],
    ['an unknown scope', { scope: 'everything', messages: ASK.messages }],
    ['a course scope without a course', { scope: 'course', messages: ASK.messages }],
    ['a class scope without a class', { scope: 'class', messages: ASK.messages }],
    ['an ID that is not a UUID', { scope: 'course', courseId: '1; drop', messages: ASK.messages }],
  ])('refuses %s', async (_name, body) => {
    const { handler, fetchMock, calls } = build()
    const response = await handler(post(body))
    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(calls('take_chat_slot')).toHaveLength(0)
  })

  // SECURITY: proves a course or class the student is not in answers "not found", the same as one
  // that does not exist, and nothing is read or sent for it.
  it.each([
    ['a course they are not in', { scope: 'course', courseId: OTHER_COURSE }],
    ['a class of a course they are not in', { scope: 'class', classId: OTHER_CLASS }],
  ])('answers not found for %s', async (_name, scope) => {
    const { handler, fetchMock, calls } = build({
      // The class exists, but belongs to a course the student is not in.
      classes: {
        data: [{ id: OTHER_CLASS, course_id: OTHER_COURSE, number: 1, title: 'Other' }],
        error: null,
      },
    })
    const response = await handler(post({ ...scope, messages: ASK.messages }))
    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(calls('take_chat_slot')).toHaveLength(0)
  })
})

describe('what the model is shown', () => {
  // Proves a question is answered, with the student's approved summaries and own notes in front of
  // the model, and the answer returned as plain text.
  it('answers from the approved summaries and the student’s own notes', async () => {
    const { handler, fetchMock } = build()
    const response = await handler(post(ASK))
    expect(response.status).toBe(200)
    await expect(bodyOf(response)).resolves.toEqual({ reply: 'A basis is a minimal spanning set.' })
    const messages = sentToModel(fetchMock)
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toContain('The class covered bases.')
    expect(messages[0]?.content).toContain('Bases span.')
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'What is a basis?' })
  })

  // SECURITY: proves the notes come only from the asking student, summaries only if published,
  // and both only from the student's own courses. The service key bypasses Row Level Security,
  // so these filters are what keep another student's notes, and a draft, out of the model.
  it('reads only the student’s own notes and published summaries of their own courses', async () => {
    const { handler, against } = build()
    await handler(post(ASK))
    const enrollment = against('enrollments')[0]
    expect(enrollment && made(enrollment, 'eq', 'student_id', STUDENT)).toBe(true)
    const notes = against('notes')
    expect(notes).toHaveLength(1)
    expect(notes[0] && made(notes[0], 'eq', 'student_id', STUDENT)).toBe(true)
    expect(notes[0] && made(notes[0], 'in', 'course_id', [COURSE])).toBe(true)
    const summaries = against('summaries')
    expect(summaries).toHaveLength(1)
    expect(summaries[0] && made(summaries[0], 'eq', 'status', 'published')).toBe(true)
    expect(summaries[0] && made(summaries[0], 'in', 'course_id', [COURSE])).toBe(true)
  })

  // Proves a class question narrows both reads to that class.
  it('narrows a class question to that class', async () => {
    const { handler, against } = build()
    await handler(post({ scope: 'class', classId: CLASS, messages: ASK.messages }))
    const notes = against('notes')[0]
    const summaries = against('summaries')[0]
    expect(notes && made(notes, 'eq', 'class_id', CLASS)).toBe(true)
    expect(summaries && made(summaries, 'eq', 'class_id', CLASS)).toBe(true)
  })

  // Proves a student with nothing to be asked about gets a plain answer, without a question being
  // sent to the model or counted.
  it('answers without the model when there is no material', async () => {
    const { handler, fetchMock, calls } = build({
      summaries: { data: [], error: null },
      notes: { data: [], error: null },
    })
    const response = await handler(post(ASK))
    expect(response.status).toBe(200)
    const body = (await bodyOf(response)) as { reply: string }
    expect(body.reply).toContain('nothing to answer from yet')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(calls('take_chat_slot')).toHaveLength(0)
  })

  // Proves a student in no course gets the same plain answer.
  it('answers without the model for a student in no course', async () => {
    const { handler, fetchMock } = build({ enrollments: { data: [], error: null } })
    const response = await handler(post(ASK))
    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the daily limit', () => {
  // Proves a slot is taken for the asking student, with the configured limit and the day's clock.
  it('takes a slot for the student before asking the model', async () => {
    const { handler, calls } = build()
    await handler(post(ASK))
    const [call] = calls('take_chat_slot')
    expect(call?.calls[0]?.[1]).toEqual({
      p_user: STUDENT,
      p_limit: 30,
      p_now: NOW.toISOString(),
    })
  })

  // Proves a student over the limit is refused with words they can read, and the model is not asked.
  it('refuses a question over the daily limit', async () => {
    const { handler, fetchMock } = build({ slot: { data: false, error: null } })
    const response = await handler(post(ASK))
    expect(response.status).toBe(429)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { kind: 'rate_limited', message: expect.stringContaining('limit') as string },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Proves a failure to count is a refusal, never a free pass.
  it('refuses when the limit cannot be checked', async () => {
    const { handler, fetchMock } = build({ slot: { data: null, error: { code: 'XX000' } } })
    expect((await handler(post(ASK))).status).toBe(502)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('when the model fails', () => {
  // Proves a busy model is a try-again-soon answer, and the question is not counted.
  it('gives the slot back and says the AI is busy', async () => {
    const { handler, calls } = build({
      fetchImpl: () => Promise.resolve(new Response('{}', { status: 429 })),
    })
    const response = await handler(post(ASK))
    expect(response.status).toBe(429)
    await expect(bodyOf(response)).resolves.toMatchObject({
      error: { kind: 'rate_limited', message: expect.stringContaining('busy') as string },
    })
    expect(calls('give_back_chat_slot')).toHaveLength(1)
  })

  // Proves any other failure is a fixed message with no detail from the model, and the slot returns.
  it.each([
    ['a server error', () => Promise.resolve(new Response('boom', { status: 500 }))],
    ['a refused key', () => Promise.resolve(new Response('{}', { status: 401 }))],
    ['a network failure', () => Promise.reject(new Error('offline'))],
    [
      'an answer with no text',
      () => Promise.resolve(new Response('{"choices":[]}', { status: 200 })),
    ],
  ])('answers %s with a fixed message and gives the slot back', async (_name, fetchImpl) => {
    const { handler, calls } = build({ fetchImpl })
    const response = await handler(post(ASK))
    expect(response.status).toBe(502)
    const text = JSON.stringify(await bodyOf(response))
    expect(text).not.toContain('boom')
    expect(text).not.toContain('groq-key')
    expect(calls('give_back_chat_slot')).toHaveLength(1)
  })

  // Proves unreadable data stops the question before the model is asked.
  it('stops when the student’s courses cannot be read', async () => {
    const { handler, fetchMock } = build({
      enrollments: { data: null, error: { code: 'XX000' } },
    })
    expect((await handler(post(ASK))).status).toBe(502)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Proves a very long answer is cut, so a reply stays a size a screen can show.
  it('cuts a very long reply', async () => {
    const { handler } = build({
      fetchImpl: () => Promise.resolve(modelAnswer('x'.repeat(9000))),
    })
    const body = (await bodyOf(await handler(post(ASK)))) as { reply: string }
    expect(body.reply.length).toBeLessThanOrEqual(4000)
  })
})
