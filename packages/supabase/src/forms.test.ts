/**
 * Tests for the public form service on Supabase (D126): what is sent to the two functions, how the
 * answer becomes a form, and how a refusal becomes an error the page can show.
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// The unit under test.
import { createSupabasePublicFormService } from './forms'

/** A client whose `rpc` answers with `answer`; the calls are kept in `rpc.mock.calls`. */
function clientAnswering(answer: { data: unknown; error: unknown }) {
  const rpc = vi.fn<(name: string, args?: Record<string, unknown>) => Promise<typeof answer>>(() =>
    Promise.resolve(answer),
  )
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

/** An open form as `public_form` returns it. */
const FORM = {
  title: 'Lecturer assessment',
  description: 'Rate one course at a time.',
  state: 'open',
  questions: [
    { id: 'q1', kind: 'lecturer', prompt: 'Who?', required: true, options: [] },
    { id: 'q2', kind: 'rating', prompt: 'Clear?', required: false, options: [] },
  ],
  lecturers: [
    { courseId: 'c1', courseCode: 'MTH 202', courseTitle: 'Linear Algebra', lecturer: 'Dr. Smith' },
  ],
}

describe('getForm', () => {
  // Proves the link is sent as the function's argument and the form comes back whole.
  it('reads the form behind a link', async () => {
    const { client, rpc } = clientAnswering({ data: FORM, error: null })

    const form = await createSupabasePublicFormService({ client }).getForm('abc')

    expect(rpc).toHaveBeenCalledWith('public_form', { p_token: 'abc' })
    expect(form).toEqual(FORM)
  })

  // Proves an unknown link is "not found" and a form of the wrong shape is refused.
  it('reports an unknown link and refuses a malformed form', async () => {
    const unknown = clientAnswering({ data: null, error: { code: 'P0002', message: 'x' } })
    await expect(
      createSupabasePublicFormService({ client: unknown.client }).getForm('nope'),
    ).rejects.toMatchObject({ kind: 'not_found' })

    const none = clientAnswering({ data: null, error: null })
    await expect(
      createSupabasePublicFormService({ client: none.client }).getForm('nope'),
    ).rejects.toMatchObject({ kind: 'not_found' })

    const broken = clientAnswering({
      data: { ...FORM, questions: [{ id: 'q', kind: 'banana' }] },
      error: null,
    })
    await expect(
      createSupabasePublicFormService({ client: broken.client }).getForm('abc'),
    ).rejects.toBeInstanceOf(Error)
  })

  // Proves a form that is not open comes back with its state and no questions.
  it('reads a closed form', async () => {
    const { client } = clientAnswering({
      data: { ...FORM, state: 'closed', questions: [], lecturers: [] },
      error: null,
    })

    const form = await createSupabasePublicFormService({ client }).getForm('abc')

    expect(form.state).toBe('closed')
    expect(form.questions).toEqual([])
  })
})

describe('submit', () => {
  // Proves the answers are sent as they are, keyed by question.
  it('sends the answers', async () => {
    const { client, rpc } = clientAnswering({ data: null, error: null })
    const answers = { q1: { courseId: 'c1', lecturer: 'Dr. Smith' }, q2: 5 }

    await createSupabasePublicFormService({ client }).submit('abc', answers)

    expect(rpc).toHaveBeenCalledWith('submit_form_response', { p_token: 'abc', p_answers: answers })
  })

  // Proves a closed form, a bad answer and a flood each reach the page as an error it can word.
  it('reports a closed form, a bad answer and a flood', async () => {
    const closed = clientAnswering({ data: null, error: { code: '55000', message: 'closed' } })
    await expect(
      createSupabasePublicFormService({ client: closed.client }).submit('abc', {}),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: 'This form is not taking answers right now.',
    })

    const bad = clientAnswering({ data: null, error: { code: '22023', message: 'invalid' } })
    await expect(
      createSupabasePublicFormService({ client: bad.client }).submit('abc', {}),
    ).rejects.toMatchObject({ kind: 'validation' })

    const flood = clientAnswering({ data: null, error: { code: '54000', message: 'many' } })
    await expect(
      createSupabasePublicFormService({ client: flood.client }).submit('abc', {}),
    ).rejects.toMatchObject({ kind: 'validation' })
  })
})
