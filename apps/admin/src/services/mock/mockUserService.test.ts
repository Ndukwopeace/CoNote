/**
 * Tests for the demo UserService: the shared contract, plus what only the demo does (the audit
 * entries it writes, and telling the app to save after each change).
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The shared rules.
import { describeUserServiceContract } from '../contracts/userService.contract'
// The data the service reads.
import { emptyPlatformData, userRecord } from '../platformData'

// The unit under test.
import { createMockUserService } from './mockUserService'

describeUserServiceContract('mock', (data, now, actorId) =>
  createMockUserService({ data, now: () => now, actorId: () => actorId, latencyMs: 0 }),
)

describe('mock UserService', () => {
  // Proves each change is written to the audit log and reported for saving.
  it('records changes in the audit log and reports them', async () => {
    // Arrange.
    const data = emptyPlatformData({
      users: [userRecord({ id: 'a1', role: 'admin' }), userRecord({ id: 's1', role: 'student' })],
    })
    const onChange = vi.fn()
    const service = createMockUserService({
      data,
      now: () => new Date('2026-10-08T12:00:00Z'),
      actorId: () => 'a1',
      latencyMs: 0,
      onChange,
    })

    // Act: one of each kind of change.
    await service.setUserStatus('s1', 'suspended')
    await service.sendPasswordReset('a1')
    await service.updateUser('s1', {
      fullName: 'S One',
      department: null,
      level: null,
      phone: null,
      studentNumber: null,
      staffNumber: null,
    })

    // Assert.
    expect(data.auditLog.map((entry) => entry.action)).toEqual([
      'user.status_changed',
      'user.password_reset_sent',
      'user.updated',
    ])
    expect(data.auditLog[0]).toMatchObject({
      actorId: 'a1',
      entityId: 's1',
      metadata: { from: 'active', to: 'suspended' },
    })
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  // Proves nothing can change without a signed-in administrator.
  it('refuses changes without a signed-in administrator', async () => {
    // Arrange.
    const service = createMockUserService({
      data: emptyPlatformData({ users: [userRecord({ id: 's1', role: 'student' })] }),
      now: () => new Date(),
      actorId: () => null,
      latencyMs: 0,
    })

    // Act and assert.
    await expect(service.setUserStatus('s1', 'inactive')).rejects.toMatchObject({
      kind: 'unauthorized',
    })
  })
})
