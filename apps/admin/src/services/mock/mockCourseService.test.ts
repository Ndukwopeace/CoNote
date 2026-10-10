/**
 * Tests for the demo CourseService: the shared contract, plus what only the demo does (the audit
 * entries it writes, and telling the app to save after each change).
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The shared rules.
import { describeCourseServiceContract } from '../contracts/courseService.contract'
// The data the service reads.
import {
  courseRecord,
  emptyPlatformData,
  enrollmentRequestRecord,
  userRecord,
} from '../platformData'

// The unit under test.
import { createMockCourseService } from './mockCourseService'

describeCourseServiceContract('mock', (data, now, actorId) =>
  createMockCourseService({ data, now: () => now, actorId: () => actorId, latencyMs: 0 }),
)

/** A small platform: an administrator, a teacher, two students and one course. */
function smallPlatform() {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'a1', role: 'admin' }),
      userRecord({ id: 't1', role: 'teacher' }),
      userRecord({ id: 's1', role: 'student' }),
      userRecord({ id: 's2', role: 'student' }),
    ],
    courses: [courseRecord({ id: 'c1', code: 'CSC 101', teacherId: null })],
  })
}

describe('mock CourseService', () => {
  // Proves each change is written to the audit log and reported for saving.
  it('records changes in the audit log and reports them', async () => {
    // Arrange.
    const data = smallPlatform()
    const onChange = vi.fn()
    const service = createMockCourseService({
      data,
      now: () => new Date('2026-10-08T12:00:00Z'),
      actorId: () => 'a1',
      latencyMs: 0,
      onChange,
    })

    // Act: one of each kind of change.
    const created = await service.createCourse({
      code: 'MTH 201',
      title: 'Calculus',
      description: '',
      department: null,
      status: 'upcoming',
      teacherId: null,
    })
    await service.updateCourse('c1', {
      code: 'CSC 101',
      title: 'Programming',
      description: '',
      department: null,
      status: 'ongoing',
      teacherId: null,
    })
    await service.assignTeacher('c1', 't1')
    await service.removeTeacher('c1')
    await service.enrollStudents('c1', ['s1', 's2'])
    await service.removeStudent('c1', 's2')
    await service.archiveCourse('c1')
    await service.restoreCourse('c1')

    // Assert.
    expect(data.auditLog.map((entry) => entry.action)).toEqual([
      'course.created',
      'course.updated',
      'course.teacher_assigned',
      'course.teacher_removed',
      'enrollment.added',
      'enrollment.added',
      'enrollment.removed',
      'course.archived',
      'course.restored',
    ])
    expect(data.auditLog[0]).toMatchObject({
      actorId: 'a1',
      entityType: 'course',
      entityId: created.id,
      metadata: { code: 'MTH 201' },
    })
    expect(data.auditLog[4]).toMatchObject({ entityId: 'c1', metadata: { studentId: 's1' } })
    expect(onChange).toHaveBeenCalledTimes(9)
  })

  // Proves an edit that changes the teacher records the teacher change too.
  it('records a teacher change made through an edit', async () => {
    const data = smallPlatform()
    const service = createMockCourseService({
      data,
      now: () => new Date(),
      actorId: () => 'a1',
      latencyMs: 0,
    })
    await service.updateCourse('c1', {
      code: 'CSC 101',
      title: 'Programming',
      description: '',
      department: null,
      status: 'ongoing',
      teacherId: 't1',
    })
    expect(data.auditLog.map((entry) => entry.action)).toEqual([
      'course.updated',
      'course.teacher_assigned',
    ])
  })

  // Proves nothing is recorded when nothing changed.
  it('records nothing when there is no teacher to remove', async () => {
    const data = smallPlatform()
    const service = createMockCourseService({
      data,
      now: () => new Date(),
      actorId: () => 'a1',
      latencyMs: 0,
    })
    await service.removeTeacher('c1')
    expect(data.auditLog).toEqual([])
  })

  // Proves nothing can change without a signed-in administrator.
  it('refuses changes without a signed-in administrator', async () => {
    // Arrange.
    const service = createMockCourseService({
      data: smallPlatform(),
      now: () => new Date(),
      actorId: () => null,
      latencyMs: 0,
    })

    // Act and assert.
    await expect(service.archiveCourse('c1')).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.enrollStudents('c1', ['s1'])).rejects.toMatchObject({
      kind: 'unauthorized',
    })
  })

  // Proves each decision on a request is audited and reported for saving, and the request records
  // who decided and when (D76).
  it('audits decisions on requests to join', async () => {
    // Arrange: two waiting requests on the small platform's course.
    const data = smallPlatform()
    data.enrollmentRequests = [
      enrollmentRequestRecord({ id: 'q1', courseId: 'c1', studentId: 's1' }),
      enrollmentRequestRecord({ id: 'q2', courseId: 'c1', studentId: 's2' }),
    ]
    const onChange = vi.fn()
    const service = createMockCourseService({
      data,
      now: () => new Date('2026-10-08T12:00:00Z'),
      actorId: () => 'a1',
      latencyMs: 0,
      onChange,
    })

    // Act.
    await service.decideEnrollmentRequest('q1', 'approved')
    await service.decideEnrollmentRequest('q2', 'declined')

    // Assert: the approval enrols and is recorded twice over; the decline once.
    expect(data.auditLog.map((entry) => entry.action)).toEqual([
      'enrollment_request.approved',
      'enrollment.added',
      'enrollment_request.declined',
    ])
    expect(data.auditLog[0]).toMatchObject({
      actorId: 'a1',
      entityType: 'course',
      entityId: 'c1',
      metadata: { studentId: 's1', requestId: 'q1' },
    })
    expect(data.enrollmentRequests.map((r) => [r.id, r.status, r.decidedBy])).toEqual([
      ['q1', 'approved', 'a1'],
      ['q2', 'declined', 'a1'],
    ])
    expect(data.enrollmentRequests[0]?.decidedAt).toBe('2026-10-08T12:00:00.000Z')
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  // Proves a refused decision leaves no trace: no audit entry and nothing to save.
  it('writes nothing when a decision is refused', async () => {
    const data = smallPlatform()
    data.enrollmentRequests = [
      enrollmentRequestRecord({ id: 'q1', courseId: 'c1', studentId: 's1' }),
    ]
    const onChange = vi.fn()
    const service = createMockCourseService({
      data,
      now: () => new Date(),
      actorId: () => 'a1',
      latencyMs: 0,
      onChange,
    })
    data.users = data.users.map((user) =>
      user.id === 's1' ? { ...user, status: 'suspended' } : user,
    )

    await expect(service.decideEnrollmentRequest('q1', 'approved')).rejects.toThrow()

    expect(data.auditLog).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
    expect(data.enrollmentRequests[0]?.status).toBe('pending')
  })
})
