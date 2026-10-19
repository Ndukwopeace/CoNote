/**
 * The contract for joining a programme (D105, D106), part of every EnrolmentService. A student
 * asks, an administrator approves, and only then are the programme's courses added. A student
 * belongs to one programme. The mock runs this file today and the Supabase implementation runs it
 * against the local stack; each passes its own fixture and its own stand-ins for the
 * administrator's two actions.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The interface under test.
import type { EnrolmentService } from '../types'

/** The programmes and courses an implementation's fixture holds. */
export interface ProgrammeFixture {
  // An open programme that links in-use, completed and archived courses and one the student is in.
  open: string
  // A second open programme.
  other: string
  // A programme closed to requests.
  closed: string
  // An archived programme.
  archived: string
  // The codes of the in-use courses the open programme links, A to Z (what the student is shown).
  openCodes: readonly string[]
  // The in-use courses of the open programme the student is not yet in: approval enrols these.
  newCourses: readonly string[]
  // A completed course the open programme links: approval must leave it alone.
  completedCourse: string
  // An archived course the open programme links: approval must leave it alone.
  archivedCourse: string
}

/** What an implementation's test file passes in. */
interface ProgrammeContractOptions {
  // The IDs the fixture uses.
  fixture: ProgrammeFixture
  // A fresh service over the fixture, and the administrator's two actions.
  create: () => {
    service: EnrolmentService
    // Approves or declines a request, as the console does.
    decide: (requestId: string, decision: 'approved' | 'declined') => Promise<void>
    // Takes the student out of their programme, as the console does.
    remove: () => Promise<void>
  }
}

/** The student's standing with each programme, by ID. */
async function standings(service: EnrolmentService) {
  const programmes = await service.listJoinableProgrammes()
  return new Map(programmes.map((programme) => [programme.id, programme]))
}

/** Behaviour every implementation of programme joining shares. */
export function runProgrammeContract(
  name: string,
  { create, fixture }: Readonly<ProgrammeContractOptions>,
) {
  describe(`Programme joining contract: ${name}`, () => {
    // Proves only open programmes are offered, with the codes of the courses a student would get.
    it('lists the open programmes with their courses in use', async () => {
      const { service } = create()

      const programmes = await standings(service)

      expect([...programmes.keys()].sort((a, b) => a.localeCompare(b))).toEqual(
        [fixture.open, fixture.other].sort((a, b) => a.localeCompare(b)),
      )
      expect(programmes.get(fixture.open)).toMatchObject({
        courseCount: fixture.openCodes.length,
        courseCodes: [...fixture.openCodes],
        membership: 'none',
        requestId: null,
      })
    })

    // Proves asking records a waiting request and enrols nothing.
    it('records a request as waiting without enrolling', async () => {
      const { service } = create()

      await service.requestProgramme(fixture.open)

      const row = (await standings(service)).get(fixture.open)
      expect(row?.membership).toBe('pending')
      expect(row?.requestId).not.toBeNull()
      const courses = await service.listJoinableCourses()
      for (const id of fixture.newCourses) {
        expect(courses.find((course) => course.id === id)?.membership).not.toBe('enrolled')
      }
    })

    // Proves one request waits at a time, for the same programme or another.
    it.each([
      ['the same programme', 'open'],
      ['another programme', 'other'],
    ] as const)('refuses a second request for %s while one waits', async (_label, which) => {
      const { service } = create()
      await service.requestProgramme(fixture.open)

      await expect(service.requestProgramme(fixture[which])).rejects.toMatchObject({
        kind: 'conflict',
      })
    })

    // Proves a closed, archived or unknown programme all answer the same way.
    it.each([
      ['a closed programme', 'closed'],
      ['an archived programme', 'archived'],
      ['an unknown programme', 'unknown'],
    ] as const)('says %s is not open', async (_label, which) => {
      const { service } = create()
      // The fixture's IDs, or one no implementation knows.
      const id = which === 'unknown' ? crypto.randomUUID() : fixture[which]

      await expect(service.requestProgramme(id)).rejects.toMatchObject({
        kind: 'validation',
        message: "This programme isn't open.",
      })
    })

    // Proves withdrawing a request puts the programme back to none, and the student may ask again.
    it('withdraws a request, and allows asking again', async () => {
      const { service } = create()
      await service.requestProgramme(fixture.open)
      const requestId = (await standings(service)).get(fixture.open)?.requestId ?? ''

      await service.cancelProgrammeRequest(requestId)

      expect((await standings(service)).get(fixture.open)).toMatchObject({
        membership: 'none',
        requestId: null,
      })
      await expect(service.requestProgramme(fixture.open)).resolves.toBeUndefined()
    })

    // Proves an unknown request is not_found.
    it('reports an unknown request as not_found', async () => {
      const { service } = create()

      await expect(service.cancelProgrammeRequest(crypto.randomUUID())).rejects.toMatchObject({
        kind: 'not_found',
      })
    })

    // Proves approval enrols the student in the courses in use and nothing else.
    it('enrols the student in the courses in use once an administrator approves', async () => {
      const { service, decide } = create()
      await service.requestProgramme(fixture.open)
      const requestId = (await standings(service)).get(fixture.open)?.requestId ?? ''

      await decide(requestId, 'approved')

      expect((await standings(service)).get(fixture.open)).toMatchObject({
        membership: 'enrolled',
        requestId: null,
      })
      const standing = new Map(
        (await service.listJoinableCourses()).map((course) => [course.id, course.membership]),
      )
      for (const id of fixture.newCourses) expect(standing.get(id)).toBe('enrolled')
      // Completed and archived courses are not in use: they are not joined (archived ones are not
      // even listed).
      expect(standing.get(fixture.completedCourse)).toBeUndefined()
      expect(standing.get(fixture.archivedCourse)).toBeUndefined()
    })

    // Proves a student belongs to one programme: once in one, no other can be asked for.
    it('refuses a request for any programme once the student is in one', async () => {
      const { service, decide } = create()
      await service.requestProgramme(fixture.open)
      await decide((await standings(service)).get(fixture.open)?.requestId ?? '', 'approved')

      await expect(service.requestProgramme(fixture.other)).rejects.toMatchObject({
        kind: 'conflict',
      })
      await expect(service.requestProgramme(fixture.open)).rejects.toMatchObject({
        kind: 'conflict',
      })
    })

    // Proves a declined request shows as declined, enrols nothing, and can be sent again.
    it('shows a declined request, and lets the student ask again', async () => {
      const { service, decide } = create()
      await service.requestProgramme(fixture.open)
      await decide((await standings(service)).get(fixture.open)?.requestId ?? '', 'declined')

      expect((await standings(service)).get(fixture.open)?.membership).toBe('declined')
      const courses = await service.listJoinableCourses()
      for (const id of fixture.newCourses) {
        expect(courses.find((course) => course.id === id)?.membership).not.toBe('enrolled')
      }
      await expect(service.requestProgramme(fixture.open)).resolves.toBeUndefined()
    })

    // Proves a decided request can't be withdrawn.
    it('refuses to withdraw a request that was decided', async () => {
      const { service, decide } = create()
      await service.requestProgramme(fixture.open)
      const requestId = (await standings(service)).get(fixture.open)?.requestId ?? ''
      await decide(requestId, 'declined')

      await expect(service.cancelProgrammeRequest(requestId)).rejects.toMatchObject({
        kind: 'conflict',
      })
    })

    // Proves an administrator's removal takes the student out of the programme and its courses,
    // and lets them ask again.
    it('lets the student ask again after an administrator removes them', async () => {
      const { service, decide, remove } = create()
      await service.requestProgramme(fixture.open)
      await decide((await standings(service)).get(fixture.open)?.requestId ?? '', 'approved')

      await remove()

      expect((await standings(service)).get(fixture.open)?.membership).toBe('none')
      const courses = await service.listJoinableCourses()
      for (const id of fixture.newCourses) {
        expect(courses.find((course) => course.id === id)?.membership).not.toBe('enrolled')
      }
      await expect(service.requestProgramme(fixture.other)).resolves.toBeUndefined()
    })
  })
}
