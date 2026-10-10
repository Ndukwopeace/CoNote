/**
 * Tests for the ID check. Database IDs are UUIDs; anything else must be turned away before it
 * reaches the database.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test.
import { isUuid } from './ids'

describe('isUuid', () => {
  // Proves ordinary IDs pass, in either letter case.
  it.each(['20000000-0000-0000-0000-000000000001', 'ABCDEF00-1111-2222-3333-444444444444'])(
    'accepts %s',
    (id) => {
      expect(isUuid(id)).toBe(true)
    },
  )

  // Proves text that is not a UUID is refused, including values built to confuse a query.
  it.each([
    '',
    'no-such-course',
    '20000000-0000-0000-0000-00000000000',
    '20000000-0000-0000-0000-0000000000011',
    ' 20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001,id.neq.x',
    "x' or '1'='1",
  ])('refuses %j', (id) => {
    expect(isUuid(id)).toBe(false)
  })
})
