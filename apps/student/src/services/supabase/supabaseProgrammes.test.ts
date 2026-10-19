/**
 * Tests for joining a programme on Supabase against a fake client (D105): how the view's rows
 * become what the dialog shows, which function is called, and how refusals read.
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

/** A row of the `joinable_programmes` view. */
function programme(id: string, code: string, isMine = false) {
  return {
    id,
    code,
    name: `Name of ${code}`,
    course_count: 2,
    course_codes: ['MTH 202', 'SWE 311'],
    is_mine: isMine,
  }
}

/** Builds the service over a fake client answering the view and the join function. */
function setup(view: TableAnswer, join: TableAnswer = { data: 3, error: null }) {
  const { client, queries } = createFakeTables((query: RecordedQuery) => {
    if (query.table === 'joinable_programmes') return view
    if (query.table === 'rpc:join_programme') return join
    throw new Error(`Unexpected table ${query.table}`)
  })
  return { service: createSupabaseEnrolmentService({ client }), queries }
}

describe('Supabase programmes: listing', () => {
  // Proves the view's rows become the shapes the dialog shows, in code order.
  it('lists the open programmes', async () => {
    const { service } = setup({
      data: [programme(SWE, 'SWE-Y3', true), programme(BMS, 'BMS-Y1')],
      error: null,
    })

    await expect(service.listJoinableProgrammes()).resolves.toEqual([
      {
        id: SWE,
        code: 'SWE-Y3',
        name: 'Name of SWE-Y3',
        courseCount: 2,
        courseCodes: ['MTH 202', 'SWE 311'],
        isMine: true,
      },
      expect.objectContaining({ id: BMS, isMine: false }),
    ])
  })

  // Proves a row of an unexpected shape is refused instead of reaching a screen.
  it('refuses a malformed row', async () => {
    const { service } = setup({ data: [{ id: SWE }], error: null })

    await expect(service.listJoinableProgrammes()).rejects.toBeDefined()
  })
})

describe('Supabase programmes: joining', () => {
  // Proves the database function is called with the programme and its count is returned.
  it('calls join_programme and returns how many courses were added', async () => {
    const { service, queries } = setup({ data: [], error: null })

    await expect(service.joinProgramme(SWE)).resolves.toBe(3)

    expect(queries.map((query) => query.table)).toEqual(['rpc:join_programme'])
    expect(queries[0]?.calls).toEqual([['rpc', { p_programme: SWE }]])
  })

  // Proves an ID that is not a UUID never reaches the database.
  it('turns away an ID that is not a UUID', async () => {
    const { service, queries } = setup({ data: [], error: null })

    await expect(service.joinProgramme('1 or 1=1')).rejects.toMatchObject({
      kind: 'validation',
      message: "This programme isn't open.",
    })
    expect(queries).toEqual([])
  })

  // Proves the database's "not found" reads like any closed programme.
  it('says a programme the database does not find is not open', async () => {
    const { service } = setup(
      { data: [], error: null },
      { data: null, error: { code: 'P0002', message: 'not found' } },
    )

    await expect(service.joinProgramme(SWE)).rejects.toMatchObject({
      kind: 'validation',
      message: "This programme isn't open.",
    })
  })

  // Proves any other refusal keeps its own kind (someone who is not a student is forbidden).
  it('maps other refusals through the shared error mapping', async () => {
    const { service } = setup(
      { data: [], error: null },
      { data: null, error: { code: '42501', message: 'forbidden' } },
    )

    await expect(service.joinProgramme(SWE)).rejects.toMatchObject({ kind: 'forbidden' })
  })

  // Proves a count that is not a whole number is refused.
  it('refuses an answer that is not a count', async () => {
    const { service } = setup({ data: [], error: null }, { data: 'three', error: null })

    await expect(service.joinProgramme(SWE)).rejects.toBeDefined()
  })
})
