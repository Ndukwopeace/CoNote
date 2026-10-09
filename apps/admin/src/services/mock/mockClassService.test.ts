/**
 * Tests for the demo ClassService: the shared contract, plus what only the demo does (the audit
 * entries it writes, and telling the app to save after each change).
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The shared rules.
import { describeClassServiceContract } from '../contracts/classService.contract'
// The data the service reads.
import { classRecord, courseRecord, emptyPlatformData, userRecord } from '../platformData'

// The unit under test.
import { createMockClassService } from './mockClassService'

describeClassServiceContract('mock', (data, now, actorId) =>
  createMockClassService({ data, now: () => now, actorId: () => actorId, latencyMs: 0 }),
)

/** A small platform: an administrator, one course and one class. */
function smallPlatform() {
  return emptyPlatformData({
    users: [userRecord({ id: 'a1', role: 'admin' })],
    courses: [courseRecord({ id: 'c1', code: 'CSC 101' })],
    classes: [classRecord({ id: 'k1', courseId: 'c1' })],
  })
}

/** A valid class form for the small platform. */
const FORM = {
  courseId: 'c1',
  title: 'Loops',
  date: '2026-10-20',
  startTime: '09:00',
  endTime: '10:00',
  description: '',
}

describe('mock ClassService', () => {
  // Proves each change is written to the audit log and reported for saving.
  it('records changes in the audit log and reports them', async () => {
    // Arrange.
    const data = smallPlatform()
    const onChange = vi.fn()
    const service = createMockClassService({
      data,
      now: () => new Date('2026-10-08T12:00:00Z'),
      actorId: () => 'a1',
      latencyMs: 0,
      onChange,
    })

    // Act: one of each kind of change.
    const created = await service.createClass(FORM)
    await service.updateClass('k1', { ...FORM, title: 'Renamed' })
    await service.archiveClass('k1')

    // Assert.
    expect(data.auditLog.map((entry) => entry.action)).toEqual([
      'class.created',
      'class.updated',
      'class.archived',
    ])
    expect(data.auditLog[0]).toMatchObject({
      actorId: 'a1',
      entityType: 'class',
      entityId: created.id,
      metadata: { courseId: 'c1', number: '2' },
    })
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  // Proves nothing can change without a signed-in administrator.
  it('refuses changes without a signed-in administrator', async () => {
    // Arrange.
    const service = createMockClassService({
      data: smallPlatform(),
      now: () => new Date(),
      actorId: () => null,
      latencyMs: 0,
    })

    // Act and assert.
    await expect(service.archiveClass('k1')).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.createClass(FORM)).rejects.toMatchObject({ kind: 'unauthorized' })
  })
})
