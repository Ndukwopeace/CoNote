/**
 * Tests for the admin form service on Supabase (D126), against a fake client: what is sent to each
 * administrator function, how rows become forms and results, and that a bad ID or a bad row is refused.
 * Who may call the functions is tested in the database.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client, and the helper that asks what a query did.
import { createFakeTables, made } from '@conote/testing/fakeTables'

// The unit under test.
import { createSupabaseAdminFormService } from './supabaseFormService'

const ID = '10000000-0000-0000-0000-000000000001'

describe('listForms and getForm', () => {
  // Proves list rows are renamed for the screen, counts included.
  it('reads the list', async () => {
    const { client } = createFakeTables(() => ({
      data: [
        {
          id: ID,
          token: 't'.repeat(32),
          title: 'Assessment',
          accepting: true,
          opens_at: null,
          closes_at: null,
          created_at: '2026-11-20T09:00:00Z',
          state: 'open',
          question_count: 5,
          response_count: 12,
        },
      ],
      error: null,
    }))

    const [form] = await createSupabaseAdminFormService({ client }).listForms()

    expect(form).toEqual({
      id: ID,
      token: 't'.repeat(32),
      title: 'Assessment',
      accepting: true,
      opensAt: null,
      closesAt: null,
      createdAt: '2026-11-20T09:00:00Z',
      state: 'open',
      questionCount: 5,
      responseCount: 12,
    })
  })

  // Proves a form is read whole, and a refusal reaches the screen as forbidden.
  it('reads a form and reports a refusal', async () => {
    const full = {
      id: ID,
      token: 't'.repeat(32),
      title: 'A',
      description: '',
      accepting: false,
      opensAt: null,
      closesAt: null,
      state: 'closed',
      responseCount: 0,
      questions: [],
      lecturers: [],
    }
    const ok = createFakeTables(() => ({ data: full, error: null }))
    await expect(
      createSupabaseAdminFormService({ client: ok.client }).getForm(ID),
    ).resolves.toEqual(full)
    expect(made(ok.queries[0]!, 'rpc', { p_id: ID })).toBe(true)

    const refused = createFakeTables(() => ({
      data: null,
      error: { code: '42501', message: 'raw' },
    }))
    await expect(
      createSupabaseAdminFormService({ client: refused.client }).getForm(ID),
    ).rejects.toMatchObject({ kind: 'forbidden' })
  })

  // SECURITY: proves an ID that is not a UUID is "not found" and never reaches the database.
  it('answers not found for a malformed ID without calling', async () => {
    const { client, queries } = createFakeTables(() => ({ data: null, error: null }))
    const service = createSupabaseAdminFormService({ client })

    await expect(service.getForm('1; drop table forms')).rejects.toMatchObject({
      kind: 'not_found',
    })
    await expect(service.deleteForm('x')).rejects.toMatchObject({ kind: 'not_found' })
    await expect(service.getSummary('x')).rejects.toMatchObject({ kind: 'not_found' })
    await expect(service.listResponses('x', {})).rejects.toMatchObject({ kind: 'not_found' })
    await expect(service.deleteResponse('x')).rejects.toMatchObject({ kind: 'not_found' })
    expect(queries).toHaveLength(0)
  })

  // Proves a form of the wrong shape is refused rather than shown.
  it('refuses a malformed form', async () => {
    const { client } = createFakeTables(() => ({
      data: { id: ID, questions: 'many' },
      error: null,
    }))

    await expect(createSupabaseAdminFormService({ client }).getForm(ID)).rejects.toBeInstanceOf(
      Error,
    )
  })
})

describe('saveForm', () => {
  // Proves a draft is sent as the function's one argument, and the new ID comes back.
  it('sends the draft and returns the ID', async () => {
    const { client, queries } = createFakeTables(() => ({ data: ID, error: null }))

    const id = await createSupabaseAdminFormService({ client }).saveForm({
      title: 'T',
      description: 'D',
      accepting: true,
      opensAt: null,
      closesAt: '2030-01-01T00:00:00Z',
      questions: [{ kind: 'rating', prompt: 'Clear?', required: true, options: [] }],
    })

    expect(id).toBe(ID)
    expect(
      made(queries[0]!, 'rpc', {
        p_form: {
          id: null,
          title: 'T',
          description: 'D',
          accepting: true,
          opensAt: null,
          closesAt: '2030-01-01T00:00:00Z',
          questions: [{ id: null, kind: 'rating', prompt: 'Clear?', required: true, options: [] }],
        },
      }),
    ).toBe(true)
  })

  // Proves the database's refusals come through as the errors the screens handle.
  it('reports a rule the database refused', async () => {
    const { client } = createFakeTables(() => ({
      data: null,
      error: { code: '22023', message: 'x' },
    }))

    await expect(
      createSupabaseAdminFormService({ client }).saveForm({
        title: 'T',
        description: '',
        accepting: false,
        opensAt: null,
        closesAt: null,
        questions: [],
      }),
    ).rejects.toMatchObject({ kind: 'validation' })
  })
})

describe('results and answers', () => {
  // Proves summary rows are renamed, averages included.
  it('reads the summary', async () => {
    const { client } = createFakeTables(() => ({
      data: [
        { course_code: 'MTH 202', lecturer: 'Dr. Smith', responses: 4, averages: { q1: 4.25 } },
      ],
      error: null,
    }))

    const rows = await createSupabaseAdminFormService({ client }).getSummary(ID)

    expect(rows).toEqual([
      { courseCode: 'MTH 202', lecturer: 'Dr. Smith', responses: 4, averages: { q1: 4.25 } },
    ])
  })

  // Proves the answers filter is sent and rows are renamed, with the total from the first row.
  it('reads a page of answers', async () => {
    const { client, queries } = createFakeTables(() => ({
      data: [
        {
          id: ID,
          created_at: '2026-11-20T09:00:00Z',
          course_code: 'MTH 202',
          lecturer: 'Dr. Smith',
          answers: { q1: 5, q2: 'Great' },
          total_count: 9,
        },
      ],
      error: null,
    }))

    const page = await createSupabaseAdminFormService({ client }).listResponses(ID, {
      courseCode: 'MTH 202',
      lecturer: 'Dr. Smith',
      offset: 50,
    })

    expect(
      made(queries[0]!, 'rpc', {
        p_id: ID,
        p_course: 'MTH 202',
        p_lecturer: 'Dr. Smith',
        p_limit: 50,
        p_offset: 50,
      }),
    ).toBe(true)
    expect(page.total).toBe(9)
    expect(page.items[0]).toEqual({
      id: ID,
      createdAt: '2026-11-20T09:00:00Z',
      courseCode: 'MTH 202',
      lecturer: 'Dr. Smith',
      answers: { q1: 5, q2: 'Great' },
    })
  })

  // Proves a page past the end still reports the real total.
  it('reads the total from the first page when the page asked for is past the end', async () => {
    const { client, queries } = createFakeTables((query) =>
      made(query, 'rpc', { p_id: ID, p_course: null, p_lecturer: null, p_limit: 1, p_offset: 0 })
        ? {
            data: [
              {
                id: ID,
                created_at: '2026-11-20T09:00:00Z',
                course_code: null,
                lecturer: null,
                answers: {},
                total_count: 4,
              },
            ],
            error: null,
          }
        : { data: [], error: null },
    )

    const page = await createSupabaseAdminFormService({ client }).listResponses(ID, { offset: 100 })

    expect(page).toEqual({ items: [], total: 4 })
    expect(queries).toHaveLength(2)
  })

  // Proves a delete is sent and the database's "not found" comes through.
  it('deletes and reports an unknown answer', async () => {
    const ok = createFakeTables(() => ({ data: null, error: null }))
    await createSupabaseAdminFormService({ client: ok.client }).deleteResponse(ID)
    expect(made(ok.queries[0]!, 'rpc', { p_id: ID })).toBe(true)

    const missing = createFakeTables(() => ({ data: null, error: { code: 'P0002', message: 'x' } }))
    await expect(
      createSupabaseAdminFormService({ client: missing.client }).deleteResponse(ID),
    ).rejects.toMatchObject({ kind: 'not_found' })
  })
})
