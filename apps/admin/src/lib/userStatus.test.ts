/**
 * Tests for which status changes an administrator may make (admin REQUIREMENTS section 11).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The units under test.
import { canSendPasswordReset, statusActions, statusLabel } from './userStatus'

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
  // Proves only active accounts can be sent a reset link; the others can't sign in anyway.
  it('allows active accounts only', () => {
    expect(canSendPasswordReset('active')).toBe(true)
    expect(canSendPasswordReset('pending')).toBe(false)
    expect(canSendPasswordReset('suspended')).toBe(false)
  })
})
