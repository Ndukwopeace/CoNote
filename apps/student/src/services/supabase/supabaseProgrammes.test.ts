/**
 * Tests for joining a programme on Supabase against a fake client (D105, D106): how the view's rows
 * become what the dialog shows, which functions are called, and how refusals read.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client, and the helper that checks what was asked.
import { createFakeTables, type RecordedQuery, type TableAnswer } from '@conote/testing/fakeTables'

// The service under test.
import { createSupabaseEnrolmentService } from './supabaseEnrolmentService'

// Made-up IDs, shaped like the database's.
const SWE = '50000000-0000-0000-0000-000000000001'
const BMS = '50000000-0000-0000-0000-000000000002'
const REQUEST = '60000000-0000-0000-0000-000000000001'

/** A row of the `joinable_programmes` view. */
function programme(id: string, code: string, membership = 'none', requestId: string | null = null) {
  return {
    id,
    code,
    name: `Name of ${code}`,
    course_count: 2,
    course_codes: ['MTH 202', 'SWE 311'],
    membership,
    request_id: requestId,
  }
}

/** Builds the service over a fake client answering the view and the functions. */
function setup(view: TableAnswer, functions: Record<string, TableAnswer> = {}) {
  const { client, queries } = createFakeTables((query: RecordedQuery) => {
    if (query.table === 'joinable_programmes') return view
    const answer = functions[query.table.replace('rpc:', '')]
    if (query.table.startsWith('rpc:') && answer) return answer
    throw new Error(`Unexpected table ${query.table}`)
  })
  return { service: createSupabaseEnrolmentService({ client }), queries }
}

describe('Supabase programmes: listing', () => {
  // Proves the view's rows become the shapes the dialog shows, with the student's standing.
  it('lists the open programmes with their standing', async () => {
    const { service } = setup({
      data: [programme(SWE, 'SWE-Y3', 'pending', REQUEST), programme(BMS, 'BMS-Y1')],
      error: null,
    })

    await expect(service.listJoinableProgrammes()).resolves.toEqual([
      {
        id: SWE,
        code: 'SWE-Y3',
        name: 'Name of SWE-Y3',
        courseCount: 2,
        courseCodes: ['MTH 202', 'SWE 311'],
        membership: 'pending',
        requestId: REQUEST,
      },
      expect.objectContaining({ id: BMS, membership: 'none', requestId: null }),
    ])
  })

  // Proves a row of an unexpected shape or standing is refused instead of reaching a screen.
  it.each([
    ['a row with missing fields', [{ id: SWE }]],
    ['a standing the app does not know', [programme(SWE, 'SWE-Y3', 'maybe')]],
  ])('refuses %s', async (_label, rows) => {
    const { service } = setup({ data: rows, error: null })

    await expect(service.listJoinableProgrammes()).rejects.toBeDefined()
  })
})

describe('Supabase programmes: asking', () => {
  // Proves the database function is called with the programme and nothing else.
  it('calls request_programme with the programme only', async () => {
    const { service, queries } = setup(
      { data: [], error: null },
      { request_programme: { data: REQUEST, error: null } },
    )

    await expect(service.requestProgramme(SWE)).resolves.toBeUndefined()

    expect(queries.map((query) => query.table)).toEqual(['rpc:request_programme'])
    expect(queries[0]?.calls).toEqual([['rpc', { p_programme: SWE }]])
  })

  // Proves an ID that is not a UUID never reaches the database.
  it('turns away an ID that is not a UUID', async () => {
    const { service, queries } = setup({ data: [], error: null })

    await expect(service.requestProgramme('1 or 1=1')).rejects.toMatchObject({
      kind: 'validation',
      message: "This programme isn't open.",
    })
    expect(queries).toEqual([])
  })

  // Proves each refusal reads in words written for people.
  it.each([
    [{ code: 'P0002', message: 'not found' }, 'validation', "This programme isn't open."],
    [
      { code: '23505', message: 'already in a programme' },
      'conflict',
      "You're already in a programme.",
    ],
    [
      { code: '23505', message: 'request already waiting' },
      'conflict',
      "You've already asked to join a programme.",
    ],
  ])('words the refusal %j', async (error, kind, message) => {
    const { service } = setup(
      { data: [], error: null },
      { request_programme: { data: null, error } },
    )

    await expect(service.requestProgramme(SWE)).rejects.toMatchObject({ kind, message })
  })

  // Proves any other refusal keeps its own kind (someone who is not a student is forbidden).
  it('maps other refusals through the shared error mapping', async () => {
    const { service } = setup(
      { data: [], error: null },
      { request_programme: { data: null, error: { code: '42501', message: 'forbidden' } } },
    )

    await expect(service.requestProgramme(SWE)).rejects.toMatchObject({ kind: 'forbidden' })
  })
})

describe('Supabase programmes: withdrawing', () => {
  // Proves the database function is called with the request.
  it('calls cancel_programme_request', async () => {
    const { service, queries } = setup(
      { data: [], error: null },
      { cancel_programme_request: { data: null, error: null } },
    )

    await expect(service.cancelProgrammeRequest(REQUEST)).resolves.toBeUndefined()

    expect(queries[0]?.calls).toEqual([['rpc', { p_request: REQUEST }]])
  })

  // Proves an ID that is not a UUID is not_found without a call.
  it('treats an ID that is not a UUID as not found', async () => {
    const { service, queries } = setup({ data: [], error: null })

    await expect(service.cancelProgrammeRequest('nope')).rejects.toMatchObject({
      kind: 'not_found',
    })
    expect(queries).toEqual([])
  })

  // Proves the database's answers become not_found and conflict.
  it.each([
    [{ code: 'P0002', message: 'not found' }, 'not_found'],
    [{ code: '23505', message: 'already decided' }, 'conflict'],
  ])('maps %j to %s', async (error, kind) => {
    const { service } = setup(
      { data: [], error: null },
      { cancel_programme_request: { data: null, error } },
    )

    await expect(service.cancelProgrammeRequest(REQUEST)).rejects.toMatchObject({ kind })
  })
})
