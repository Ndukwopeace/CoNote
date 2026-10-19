/**
 * Tests for the demo ProgrammeService: the shared contract, plus what only the demo does (the
 * audit entry it writes, telling the app to save, and refusing a signed-out caller).
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The shared rules.
import { describeProgrammeServiceContract } from '../contracts/programmeService.contract'
// The data the service reads.
import { courseRecord, emptyPlatformData, userRecord } from '../platformData'

// The unit under test.
import { createMockProgrammeService } from './mockProgrammeService'

describeProgrammeServiceContract('mock', (data, now, actorId) =>
  createMockProgrammeService({ data, now: () => now, actorId: () => actorId, latencyMs: 0 }),
)

/** A small platform: an administrator and one course. */
function smallPlatform() {
  return emptyPlatformData({
    users: [userRecord({ id: 'a1', role: 'admin' })],
    courses: [courseRecord({ id: 'c1', code: 'CSC 101' })],
  })
}

/** An import of one new course with one class. */
const payload = {
  timezone: 'Africa/Douala',
  programmes: [{ code: 'SWE-Y1', name: 'Software Engineering · Year 1', courseCodes: ['NEW 101'] }],
  courses: [
    {
      code: 'NEW 101',
      title: 'New',
      teacherId: null,
      sessions: [{ start: '2026-10-20T08:00', end: '2026-10-20T12:00', title: 'Week 2' }],
    },
  ],
}

describe('mock ProgrammeService', () => {
  // Proves a real import is audited with counts only, saved, and stores times in UTC.
  it('audits an import, reports it for saving and stores UTC times', async () => {
    const data = smallPlatform()
    const onChange = vi.fn()
    const service = createMockProgrammeService({
      data,
      now: () => new Date('2026-10-20T12:00:00Z'),
      actorId: () => 'a1',
      latencyMs: 0,
      onChange,
    })

    await service.importTimetable(payload, { dryRun: false })

    expect(onChange).toHaveBeenCalledOnce()
    expect(data.auditLog.at(-1)).toMatchObject({
      actorId: 'a1',
      action: 'timetable.import',
      entityType: 'timetable',
      metadata: { coursesCreated: '1', classesCreated: '1' },
    })
    // 08:00 in Douala is 07:00 UTC.
    expect(data.classes.at(-1)?.startsAt).toBe('2026-10-20T07:00:00.000Z')
    expect(data.classes.at(-1)).toMatchObject({ number: 1, title: 'Week 2', noteCount: 0 })
  })

  // Proves a dry run saves nothing, reports nothing for saving and writes no audit entry.
  it('leaves everything alone on a dry run', async () => {
    const data = smallPlatform()
    const onChange = vi.fn()
    const service = createMockProgrammeService({
      data,
      now: () => new Date('2026-10-20T12:00:00Z'),
      actorId: () => 'a1',
      latencyMs: 0,
      onChange,
    })

    await service.importTimetable(payload, { dryRun: true })

    expect(onChange).not.toHaveBeenCalled()
    expect(data.auditLog).toEqual([])
    expect(data.courses).toHaveLength(1)
    expect(data.classes).toEqual([])
    expect(data.programmes).toEqual([])
  })

  // Proves nobody signed out can change anything.
  it('refuses a caller who is not signed in', async () => {
    const service = createMockProgrammeService({
      data: smallPlatform(),
      now: () => new Date(),
      actorId: () => null,
      latencyMs: 0,
    })

    await expect(service.importTimetable(payload, { dryRun: false })).rejects.toMatchObject({
      kind: 'unauthorized',
    })
    await expect(service.setEnrolmentOpen('p1', false)).rejects.toMatchObject({
      kind: 'unauthorized',
    })
  })

  // Proves a new course's status follows today's date against its classes.
  it('marks a new course upcoming, ongoing or completed by its classes', async () => {
    const statusOn = async (today: string) => {
      const data = smallPlatform()
      await createMockProgrammeService({
        data,
        now: () => new Date(today),
        actorId: () => 'a1',
        latencyMs: 0,
      }).importTimetable(payload, { dryRun: false })
      return data.courses.at(-1)?.status
    }

    expect(await statusOn('2026-10-01T00:00:00Z')).toBe('upcoming')
    expect(await statusOn('2026-10-20T08:00:00Z')).toBe('ongoing')
    expect(await statusOn('2026-11-30T00:00:00Z')).toBe('completed')
  })

  // Proves class numbers carry on after the course's last class, archived ones counted.
  it('numbers new classes after the last one, archived included', async () => {
    const data = smallPlatform()
    data.classes.push({
      id: 'k1',
      courseId: 'c1',
      number: 4,
      title: 'Old',
      description: '',
      startsAt: '2026-09-01T07:00:00.000Z',
      endsAt: '2026-09-01T09:00:00.000Z',
      noteCount: 0,
      archivedAt: '2026-09-02T00:00:00.000Z',
    })
    const service = createMockProgrammeService({
      data,
      now: () => new Date('2026-10-20T12:00:00Z'),
      actorId: () => 'a1',
      latencyMs: 0,
    })

    await service.importTimetable(
      {
        timezone: 'Africa/Douala',
        programmes: [],
        courses: [
          {
            code: 'CSC 101',
            title: 'x',
            teacherId: null,
            sessions: [{ start: '2026-10-20T08:00', end: '2026-10-20T10:00', title: 'Week 2' }],
          },
        ],
      },
      { dryRun: false },
    )

    expect(data.classes.at(-1)?.number).toBe(5)
  })
})
