/**
 * The contract every EnrolmentService must meet (FR-ENR, D76). The mock runs it today; the
 * Supabase implementation runs the same file in the backend stage (ENGINEERING_STANDARDS.md 2.5).
 * Approval happens in the admin console, so the contract reaches it through `decide`, which each
 * implementation's test wires to its own way of recording an admin's decision.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The interface under test.
import type { EnrolmentService } from '../types'

/** The courses every implementation's fixture must hold. */
export const FIXTURE = {
  // Ongoing, not joined.
  open: 'open-1',
  // Upcoming, not joined.
  upcoming: 'open-2',
  // Completed: not open for requests.
  completed: 'done-1',
  // Archived: not listed, not open.
  archived: 'old-1',
  // Ongoing, and the student is already in it.
  enrolled: 'mine-1',
} as const

/** What an implementation's test file passes in. */
interface EnrolmentContractOptions {
  /** A fresh service over the fixture, and the admin's side of a request. */
  create: () => {
    service: EnrolmentService
    // Records an admin's decision on a request.
    decide: (requestId: string, decision: 'approved' | 'declined') => Promise<void>
  }
}

/** Behaviour every implementation of the enrolment service shares. */
export function runEnrolmentServiceContract(name: string, { create }: EnrolmentContractOptions) {
  describe(`Enrolment service contract: ${name}`, () => {
    // Proves the list holds courses in use only, with the student's standing in each.
    it('lists courses in use with the student’s standing', async () => {
      const { service } = create()

      const courses = await service.listJoinableCourses()

      expect(courses.map((course) => course.id).sort((a, b) => a.localeCompare(b))).toEqual(
        [FIXTURE.enrolled, FIXTURE.open, FIXTURE.upcoming].sort((a, b) => a.localeCompare(b)),
      )
      const standing = Object.fromEntries(courses.map((course) => [course.id, course.membership]))
      expect(standing).toEqual({
        [FIXTURE.open]: 'none',
        [FIXTURE.upcoming]: 'none',
        [FIXTURE.enrolled]: 'enrolled',
      })
      // Every row says who teaches it, and none offers a request to cancel yet.
      for (const course of courses) {
        expect(course.teacherName).not.toBe('')
        expect(course.requestId).toBeNull()
      }
    })

    // Proves the search matches the code or the title, in any letter case, and a blank one lists all.
    it('searches by code or title', async () => {
      const { service } = create()
      const all = await service.listJoinableCourses()
      const sample = all.find((course) => course.id === FIXTURE.open)

      const byCode = await service.listJoinableCourses(` ${(sample?.code ?? '').toLowerCase()} `)
      const byTitle = await service.listJoinableCourses((sample?.title ?? '').toUpperCase())

      expect(byCode.map((course) => course.id)).toContain(FIXTURE.open)
      expect(byTitle.map((course) => course.id)).toContain(FIXTURE.open)
      await expect(service.listJoinableCourses('zzz-no-such-course')).resolves.toEqual([])
      await expect(service.listJoinableCourses('   ')).resolves.toHaveLength(all.length)
    })

    // Proves a request is recorded, shows as pending in both lists, and grants nothing.
    it('records a request as pending without enrolling', async () => {
      const { service } = create()

      const request = await service.requestToJoin(FIXTURE.open)

      expect(request).toMatchObject({ courseId: FIXTURE.open, status: 'pending' })
      await expect(service.listMyJoinRequests()).resolves.toEqual([request])
      const row = (await service.listJoinableCourses()).find((c) => c.id === FIXTURE.open)
      expect(row).toMatchObject({ membership: 'pending', requestId: request.id })
    })

    // Proves a second request for the same course, or one for a course the student is in, is refused.
    it.each([
      ['a course with a request waiting', FIXTURE.open],
      ['a course the student is already in', FIXTURE.enrolled],
    ])('refuses a request for %s', async (_label, courseId) => {
      const { service } = create()
      if (courseId === FIXTURE.open) await service.requestToJoin(courseId)

      await expect(service.requestToJoin(courseId)).rejects.toMatchObject({ kind: 'conflict' })
    })

    // Proves archived, completed and unknown courses all answer the same way.
    it.each([FIXTURE.archived, FIXTURE.completed, 'no-such-course'])(
      'says a request for %s is not open',
      async (courseId) => {
        const { service } = create()

        await expect(service.requestToJoin(courseId)).rejects.toMatchObject({
          kind: 'validation',
          message: "This course isn't open for requests.",
        })
      },
    )

    // Proves cancelling withdraws a pending request, and the student can ask again afterwards.
    it('cancels a pending request, and allows asking again', async () => {
      const { service } = create()
      const request = await service.requestToJoin(FIXTURE.open)

      await service.cancelJoinRequest(request.id)

      await expect(service.listMyJoinRequests()).resolves.toEqual([])
      const row = (await service.listJoinableCourses()).find((c) => c.id === FIXTURE.open)
      expect(row).toMatchObject({ membership: 'none', requestId: null })
      await expect(service.requestToJoin(FIXTURE.open)).resolves.toMatchObject({
        status: 'pending',
      })
    })

    // Proves an unknown request is not_found.
    it('reports an unknown request as not_found', async () => {
      const { service } = create()

      await expect(service.cancelJoinRequest('no-such-request')).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // Proves approval enrols the student: the course reads "enrolled" and the request leaves the list.
    it('shows a course as joined once an admin approves', async () => {
      const { service, decide } = create()
      const request = await service.requestToJoin(FIXTURE.open)

      await decide(request.id, 'approved')

      await expect(service.listMyJoinRequests()).resolves.toEqual([])
      const row = (await service.listJoinableCourses()).find((c) => c.id === FIXTURE.open)
      expect(row).toMatchObject({ membership: 'enrolled', requestId: null })
      // A decided request can't be withdrawn.
      await expect(service.cancelJoinRequest(request.id)).rejects.toMatchObject({
        kind: 'conflict',
      })
    })

    // Proves a declined request stays visible as declined, can't be cancelled, and can be sent again.
    it('keeps a declined request visible and lets the student ask again', async () => {
      const { service, decide } = create()
      const request = await service.requestToJoin(FIXTURE.open)

      await decide(request.id, 'declined')

      await expect(service.listMyJoinRequests()).resolves.toEqual([
        { ...request, status: 'declined' },
      ])
      const row = (await service.listJoinableCourses()).find((c) => c.id === FIXTURE.open)
      expect(row).toMatchObject({ membership: 'declined', requestId: null })
      await expect(service.cancelJoinRequest(request.id)).rejects.toMatchObject({
        kind: 'conflict',
      })
      // A new request replaces the declined one in the list.
      const again = await service.requestToJoin(FIXTURE.open)
      expect(again.id).not.toBe(request.id)
      await expect(service.listMyJoinRequests()).resolves.toEqual([again])
    })

    // Proves requests are listed newest first.
    it('lists requests newest first', async () => {
      const { service } = create()
      const first = await service.requestToJoin(FIXTURE.open)
      const second = await service.requestToJoin(FIXTURE.upcoming)

      const requests = await service.listMyJoinRequests()

      expect(requests.map((request) => request.id)).toEqual([second.id, first.id])
    })
  })
}
