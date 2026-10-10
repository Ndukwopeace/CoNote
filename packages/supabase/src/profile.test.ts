/**
 * Tests for turning a `profiles` row into the signed-in user the apps use. Database rows are not
 * trusted: a row that does not match the expected shape is refused.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { fetchProfile, parseProfileRow, toSessionUser } from './profile'

// The client type, for the fake below.
import type { SupabaseClient } from '@supabase/supabase-js'

/** A well-formed row, as the database returns it. */
const ROW = {
  id: '10000000-0000-0000-0000-000000000004',
  role: 'student',
  status: 'active',
  full_name: 'Victory Eze',
  email: 'student@conote.example',
  avatar_url: null,
}

describe('parseProfileRow', () => {
  // Proves a good row is accepted.
  it('accepts a well-formed row', () => {
    expect(parseProfileRow(ROW)).toMatchObject({ role: 'student', status: 'active' })
  })

  // SECURITY: proves an unknown role cannot slip through to the route guards.
  it.each([
    [{ ...ROW, role: 'superuser' }],
    [{ ...ROW, status: 'banned' }],
    [{ ...ROW, email: 'not-an-email' }],
    [{ ...ROW, id: '' }],
    [null],
    ['row'],
  ])('refuses a malformed row %#', (row) => {
    expect(() => parseProfileRow(row)).toThrow()
  })
})

describe('toSessionUser', () => {
  // Proves the fields are carried over under the app's names.
  it('maps a row to a session user', () => {
    expect(toSessionUser(parseProfileRow(ROW))).toEqual({
      id: ROW.id,
      role: 'student',
      fullName: 'Victory Eze',
      email: 'student@conote.example',
    })
  })

  // Proves the avatar is included only when there is one (the strict optional-type rule).
  it('includes the avatar only when present', () => {
    const withAvatar = toSessionUser(
      parseProfileRow({ ...ROW, avatar_url: 'https://x.test/a.png' }),
    )
    expect(withAvatar.avatarUrl).toBe('https://x.test/a.png')
    expect('avatarUrl' in toSessionUser(parseProfileRow(ROW))).toBe(false)
  })

  // Proves a blank name falls back to the start of the email, so the greeting is never empty.
  it('falls back to the email name when the full name is blank', () => {
    const user = toSessionUser(parseProfileRow({ ...ROW, full_name: '  ' }))
    expect(user.fullName).toBe('student')
  })
})

/** A fake client whose profile query ends with `result`. */
function clientReturning(result: { data: unknown; error: unknown }) {
  const query = { select: () => query, eq: () => query, single: () => Promise.resolve(result) }
  return { from: () => query } as unknown as SupabaseClient
}

describe('fetchProfile', () => {
  // Proves a good row is returned checked.
  it('returns the checked row', async () => {
    const row = await fetchProfile(clientReturning({ data: ROW, error: null }), ROW.id)
    expect(row.role).toBe('student')
  })

  // Proves a refused read (no policy for this row) becomes a forbidden error.
  it('turns a database error into an AppError', async () => {
    await expect(
      fetchProfile(
        clientReturning({ data: null, error: { code: '42501', message: 'raw' } }),
        ROW.id,
      ),
    ).rejects.toMatchObject({ kind: 'forbidden' })
  })

  // SECURITY: proves a row with an unknown role is refused, never trusted.
  it('refuses a malformed row', async () => {
    await expect(
      fetchProfile(clientReturning({ data: { ...ROW, role: 'root' }, error: null }), ROW.id),
    ).rejects.toMatchObject({ kind: 'unknown' })
  })
})
