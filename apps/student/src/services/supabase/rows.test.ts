/**
 * Tests for reading and checking rows. A row of the wrong shape is a server problem, and no raw
 * database text may reach the person.
 */

// zod builds the row shape used below.
import { z } from 'zod'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The error type every failure becomes.
import { AppError } from '@conote/core/errors'

// The functions under test.
import { readOne, readRows } from './rows'

// A tiny row shape.
const rowSchema = z.object({ id: z.string(), count: z.number() })

/** A finished query that answers with `data` and `error`. */
function answer(data: unknown, error: unknown = null) {
  return Promise.resolve({ data, error })
}

describe('readRows', () => {
  // Proves good rows come back as they are.
  it('returns the checked rows', async () => {
    await expect(readRows(answer([{ id: 'a', count: 1 }]), rowSchema)).resolves.toEqual([
      { id: 'a', count: 1 },
    ])
  })

  // Proves no rows (null from the server) is an empty list, not a crash.
  it('treats null as no rows', async () => {
    await expect(readRows(answer(null), rowSchema)).resolves.toEqual([])
  })

  // Proves a server error becomes an AppError with a safe message.
  it('turns a refusal into an AppError', async () => {
    const attempt = readRows(
      answer(null, { code: '42501', message: 'permission denied for x' }),
      rowSchema,
    )

    await expect(attempt).rejects.toBeInstanceOf(AppError)
    await expect(attempt).rejects.toMatchObject({ kind: 'forbidden' })
  })

  // SECURITY: proves a malformed row is refused without copying its contents into the message.
  it('refuses a row of the wrong shape', async () => {
    const attempt = readRows(answer([{ id: 'a', count: 'secret-text' }]), rowSchema)

    await expect(attempt).rejects.toMatchObject({ kind: 'unknown', message: 'Unexpected error' })
    await expect(attempt).rejects.not.toThrow(/secret-text/)
  })
})

describe('readOne', () => {
  // Proves one row comes back checked, and no row is null.
  it('returns the row, or null when there is none', async () => {
    await expect(readOne(answer({ id: 'a', count: 1 }), rowSchema)).resolves.toEqual({
      id: 'a',
      count: 1,
    })
    await expect(readOne(answer(null), rowSchema)).resolves.toBeNull()
  })

  // Proves errors and malformed rows are handled as in readRows.
  it('turns errors and malformed rows into AppErrors', async () => {
    await expect(
      readOne(answer(null, { code: 'PGRST301', message: 'x' }), rowSchema),
    ).rejects.toMatchObject({
      kind: 'unauthorized',
    })
    await expect(readOne(answer({ id: 1 }), rowSchema)).rejects.toMatchObject({ kind: 'unknown' })
  })
})
