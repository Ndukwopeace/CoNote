/**
 * The rules every UserService must follow (ENGINEERING_STANDARDS.md 2.5), run against each
 * implementation. Each run starts from the same small platform built here.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared vocabulary.
import type { Role } from '@conote/domain'

// The data the services read, and the record builders.
import { courseRecord, emptyPlatformData, userRecord, type PlatformData } from '../platformData'
// The interface under test.
import type { UserService } from '../types'

/** Builds a service over `data`, with the clock at `now`, acting as administrator `actorId`. */
export type CreateUserService = (data: PlatformData, now: Date, actorId: string) => UserService

/** The contract's clock. */
const NOW = new Date('2026-10-08T12:00:00.000Z')

/** `days` days before NOW, as ISO text. */
function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

/**
 * The platform: two administrators (Amara acts), two teachers, 25 students in two departments,
 * two courses (one taught by each teacher) and an archived one, and a little history.
 */
function platform(): PlatformData {
  // Students 01 to 25: odd ones in Computer Science, even ones in English; s03 is suspended.
  const students = Array.from({ length: 25 }, (_, index) => {
    const n = String(index + 1).padStart(2, '0')
    return userRecord({
      id: `s${n}`,
      role: 'student',
      status: n === '03' ? 'suspended' : 'active',
      fullName: `Student ${n}`,
      email: `student${n}@conote.example`,
      studentNumber: `U2023/50${n}`,
      department: (index + 1) % 2 === 1 ? 'Computer Science' : 'English',
      createdAt: daysAgo(100 - index),
      lastActiveAt: index === 0 ? null : daysAgo(index),
    })
  })
  return emptyPlatformData({
    users: [
      userRecord({ id: 'a1', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 'a2', role: 'admin', fullName: 'Bola Adeyemi' }),
      userRecord({
        id: 't1',
        role: 'teacher',
        fullName: 'Dr. Smith',
        staffNumber: 'STF-0101',
        department: 'Computer Science',
      }),
      userRecord({ id: 't2', role: 'teacher', fullName: 'Mrs. Okoro', department: 'English' }),
      ...students,
    ],
    courses: [
      courseRecord({
        id: 'c1',
        code: 'CSC 101',
        title: 'Programming',
        teacherId: 't1',
        archivedAt: null,
      }),
      courseRecord({
        id: 'c2',
        code: 'ENG 101',
        title: 'Writing',
        teacherId: 't2',
        archivedAt: null,
      }),
      courseRecord({
        id: 'c3',
        code: 'OLD 100',
        title: 'Old',
        teacherId: 't1',
        archivedAt: daysAgo(30),
      }),
    ],
    enrollments: [
      { courseId: 'c1', studentId: 's01' },
      { courseId: 'c2', studentId: 's01' },
      { courseId: 'c2', studentId: 's02' },
    ],
    auditLog: [
      {
        id: 'e1',
        at: daysAgo(100),
        actorId: 'a1',
        action: 'user.invited',
        entityType: 'user',
        entityId: 's01',
        metadata: { role: 'student', status: 'pending' },
      },
      {
        id: 'e2',
        at: daysAgo(99),
        actorId: 's01',
        action: 'user.status_changed',
        entityType: 'user',
        entityId: 's01',
        metadata: { from: 'pending', to: 'active' },
      },
    ],
  })
}

/** Registers the UserService contract suite under `name`. */
export function describeUserServiceContract(name: string, create: CreateUserService) {
  /** A fresh service over the platform, acting as Amara. */
  const service = () => create(platform(), NOW, 'a1')
  /** The names on one page for `role`. */
  const names = async (svc: UserService, role: Role, extra = {}) =>
    (await svc.listUsers({ role, ...extra })).items.map((user) => user.fullName)

  describe(`UserService contract: ${name}`, () => {
    // Proves the list shows one role, A to Z, 20 to a page, with the full count.
    it('lists one role by name, 20 to a page', async () => {
      // Act.
      const page = await service().listUsers({ role: 'student' })

      // Assert.
      expect(page).toMatchObject({ total: 25, page: 1, pageSize: 20 })
      expect(page.items).toHaveLength(20)
      expect(page.items[0]?.fullName).toBe('Student 01')
      expect(page.items.every((user) => user.role === 'student')).toBe(true)
    })

    // Proves the second page holds the rest.
    it('returns later pages', async () => {
      const page = await service().listUsers({ role: 'student', page: 2 })
      expect(page.items.map((user) => user.fullName)).toEqual([
        'Student 21',
        'Student 22',
        'Student 23',
        'Student 24',
        'Student 25',
      ])
    })

    // Proves the search matches name, email and number, ignoring case.
    it('searches names, emails and numbers', async () => {
      const svc = service()
      await expect(names(svc, 'teacher', { q: 'SMITH' })).resolves.toEqual(['Dr. Smith'])
      await expect(names(svc, 'student', { q: 'student07@' })).resolves.toEqual(['Student 07'])
      await expect(names(svc, 'student', { q: 'u2023/5012' })).resolves.toEqual(['Student 12'])
      await expect(names(svc, 'teacher', { q: 'stf-0101' })).resolves.toEqual(['Dr. Smith'])
    })

    // Proves the status, department and course filters.
    it('filters by status, department and course', async () => {
      const svc = service()
      await expect(names(svc, 'student', { status: 'suspended' })).resolves.toEqual(['Student 03'])
      expect((await svc.listUsers({ role: 'student', department: 'English' })).total).toBe(12)
      // Students enrolled in the course, and the teacher who teaches it.
      await expect(names(svc, 'student', { courseId: 'c2' })).resolves.toEqual([
        'Student 01',
        'Student 02',
      ])
      await expect(names(svc, 'teacher', { courseId: 'c2' })).resolves.toEqual(['Mrs. Okoro'])
    })

    // Proves sorting by creation and by last activity, with never-active accounts last.
    it('sorts by created and last active', async () => {
      const svc = service()
      // Newest first: student 25 was created last.
      expect((await names(svc, 'student', { sort: '-created' }))[0]).toBe('Student 25')
      // Most recent activity first; student 01 has never been active, so comes last.
      const recent = await svc.listUsers({ role: 'student', sort: '-lastActive', page: 2 })
      expect(recent.items.at(-1)?.fullName).toBe('Student 01')
    })

    // Proves course counts: courses in use that the account is enrolled in or teaches. Dr. Smith's
    // archived course doesn't count.
    it('counts each account’s current courses', async () => {
      const svc = service()
      const students = await svc.listUsers({ role: 'student', q: 'Student 01' })
      expect(students.items[0]?.courseCount).toBe(2)
      const teachers = await svc.listUsers({ role: 'teacher', q: 'Smith' })
      expect(teachers.items[0]?.courseCount).toBe(1)
    })

    // Proves the filter choices: departments in order, and the courses in use.
    it('offers departments and active courses as filters', async () => {
      await expect(service().listFilterOptions()).resolves.toEqual({
        departments: ['Computer Science', 'English'],
        courses: [
          { id: 'c1', code: 'CSC 101', title: 'Programming' },
          { id: 'c2', code: 'ENG 101', title: 'Writing' },
        ],
      })
    })

    // Proves the details: courses, and the status history read from the audit log.
    it('shows an account’s details and history', async () => {
      // Act.
      const details = await service().getUser('s01')

      // Assert.
      expect(details.courses.map((course) => course.code)).toEqual(['CSC 101', 'ENG 101'])
      expect(details.statusHistory).toEqual([
        { status: 'pending', at: daysAgo(100), byName: 'Amara Okafor' },
        { status: 'active', at: daysAgo(99), byName: null },
      ])
    })

    // Proves an unknown account is not found.
    it('rejects an unknown account', async () => {
      await expect(service().getUser('nobody')).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves an invitation creates an invited account, recorded in its history.
    it('invites someone', async () => {
      // Arrange.
      const svc = service()

      // Act.
      const invited = await svc.inviteUser({
        role: 'teacher',
        fullName: 'Ngozi Eze',
        email: ' Ngozi@Conote.Example ',
        department: 'English',
      })

      // Assert: invited, listed, and in the history.
      expect(invited).toMatchObject({
        role: 'teacher',
        status: 'pending',
        email: 'ngozi@conote.example',
        createdAt: NOW.toISOString(),
        lastActiveAt: null,
        statusHistory: [{ status: 'pending', at: NOW.toISOString(), byName: 'Amara Okafor' }],
      })
      await expect(names(svc, 'teacher')).resolves.toContain('Ngozi Eze')
    })

    // Proves an email can't be invited twice, whatever its case, and bad input is refused.
    it('refuses a taken email and invalid input', async () => {
      const svc = service()
      await expect(
        svc.inviteUser({
          role: 'student',
          fullName: 'X',
          email: 'STUDENT01@conote.example',
          department: 'English',
        }),
      ).rejects.toMatchObject({ kind: 'conflict' })
      await expect(
        svc.inviteUser({
          role: 'student',
          fullName: '',
          email: 'x@conote.example',
          department: 'English',
        }),
      ).rejects.toMatchObject({ kind: 'validation' })
    })

    // Proves profile changes are saved, and checked.
    it('updates a profile', async () => {
      // Arrange.
      const svc = service()
      const input = {
        fullName: 'Student One',
        department: 'English',
        level: '200 Level',
        phone: '+234 803 555 0001',
        studentNumber: 'U2023/9999',
        staffNumber: null,
      }

      // Act.
      const updated = await svc.updateUser('s01', input)

      // Assert: saved, and an empty name is refused.
      expect(updated).toMatchObject(input)
      await expect(svc.getUser('s01')).resolves.toMatchObject({ fullName: 'Student One' })
      await expect(svc.updateUser('s01', { ...input, fullName: ' ' })).rejects.toMatchObject({
        kind: 'validation',
      })
      await expect(svc.updateUser('nobody', input)).rejects.toMatchObject({ kind: 'not_found' })
    })

    // Proves a status change is applied and recorded with who made it.
    it('changes status and records it', async () => {
      // Arrange.
      const svc = service()

      // Act.
      const suspended = await svc.setUserStatus('s01', 'suspended')

      // Assert.
      expect(suspended.status).toBe('suspended')
      expect(suspended.statusHistory.at(-1)).toEqual({
        status: 'suspended',
        at: NOW.toISOString(),
        byName: 'Amara Okafor',
      })
    })

    // Proves the rules: no change the rules don't allow, and no change to one's own account.
    it('refuses changes the rules don’t allow', async () => {
      const svc = service()
      // Suspended accounts can only be activated.
      await expect(svc.setUserStatus('s03', 'inactive')).rejects.toMatchObject({
        kind: 'validation',
      })
      // An administrator can't lock themselves out.
      await expect(svc.setUserStatus('a1', 'inactive')).rejects.toMatchObject({
        kind: 'validation',
      })
      await expect(svc.setUserStatus('nobody', 'active')).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // Proves reset links go only to active accounts.
    it('sends a reset link to active accounts only', async () => {
      const svc = service()
      await expect(svc.sendPasswordReset('s01')).resolves.toBeUndefined()
      await expect(svc.sendPasswordReset('s03')).rejects.toMatchObject({ kind: 'validation' })
    })
  })
}
