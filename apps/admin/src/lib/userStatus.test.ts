/**
 * Tests for which status changes an administrator may make (admin REQUIREMENTS section 11).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { canDeleteInvitation, canSendPasswordReset, statusActions, statusLabel } from './userStatus'

describe('statusActions', () => {
  // Proves each status offers only the changes that make sense from it, in a fixed order.
  it.each([
    ['active', ['Deactivate', 'Suspend']],
    ['inactive', ['Activate', 'Suspend']],
    ['suspended', ['Activate']],
    ['pending', ['Deactivate']],
  ] as const)('from %s offers %j', (status, labels) => {
    expect(statusActions(status).map((action) => action.label)).toEqual(labels)
  })

  // Proves blocking an account asks first, and restoring one doesn't.
  it('asks for confirmation before blocking, not before activating', () => {
    expect(statusActions('active').every((action) => action.confirm)).toBe(true)
    expect(statusActions('suspended')[0]).toMatchObject({ to: 'active', confirm: false })
  })
})

describe('statusLabel', () => {
  // Proves every status reads as a word, with "pending" shown as "Invited".
  it('names every status', () => {
    expect(
      ['active', 'inactive', 'suspended', 'pending'].map((s) => statusLabel(s as 'active')),
    ).toEqual(['Active', 'Inactive', 'Suspended', 'Invited'])
  })
})

describe('canSendPasswordReset', () => {
  // Proves a link can go to accounts that can sign in and to invited ones (the invitation again),
  // not to a blocked account.
  it('allows active and invited accounts only', () => {
    expect(canSendPasswordReset('active')).toBe(true)
    expect(canSendPasswordReset('pending')).toBe(true)
    expect(canSendPasswordReset('inactive')).toBe(false)
    expect(canSendPasswordReset('suspended')).toBe(false)
  })
})

describe('canDeleteInvitation', () => {
  // Proves only an invitation nobody accepted can be deleted; anyone else is deactivated, which
  // keeps their notes and history.
  it('allows invited accounts only', () => {
    expect(canDeleteInvitation('pending')).toBe(true)
    expect(canDeleteInvitation('active')).toBe(false)
    expect(canDeleteInvitation('inactive')).toBe(false)
    expect(canDeleteInvitation('suspended')).toBe(false)
  })
})
