/**
 * The contract for joining a programme (D105), part of every EnrolmentService. The mock runs it
 * today and the Supabase implementation runs the same file against the local stack. Each
 * implementation's test passes the IDs its fixture uses.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The interface under test.
import type { EnrolmentService } from '../types'

/** The programmes and courses an implementation's fixture holds. */
export interface ProgrammeFixture {
  // An open programme that links in-use, completed and archived courses and one the student is in.
  open: string
  // A programme closed to joining.
  closed: string
  // An archived programme.
  archived: string
  // The codes of the in-use courses the open programme links, A to Z (what the student is shown).
  openCodes: readonly string[]
  // The in-use courses of the open programme the student is not yet in: joining enrols these.
  newCourses: readonly string[]
  // A completed course the open programme links: joining must leave it alone.
  completedCourse: string
  // An archived course the open programme links: joining must leave it alone.
  archivedCourse: string
}

/** What an implementation's test file passes in. */
interface ProgrammeContractOptions {
  // The IDs the fixture uses.
  fixture: ProgrammeFixture
  // A fresh service over the fixture.
  create: () => { service: EnrolmentService }
}

/** Behaviour every implementation of programme joining shares. */
export function runProgrammeContract(
  name: string,
  { create, fixture }: Readonly<ProgrammeContractOptions>,
) {
  describe(`Programme joining contract: ${name}`, () => {
    // Proves only open programmes are offered, with the codes of the courses a student would join.
    it('lists the open programmes with their courses in use', async () => {
      const { service } = create()

      const programmes = await service.listJoinableProgrammes()

      expect(programmes.map((programme) => programme.id)).toEqual([fixture.open])
      expect(programmes[0]).toMatchObject({
        courseCount: fixture.openCodes.length,
        courseCodes: [...fixture.openCodes],
        isMine: false,
      })
    })

    // Proves joining enrols the student in every course in use and nothing else.
    it('enrols the student in the courses in use', async () => {
      const { service } = create()

      const added = await service.joinProgramme(fixture.open)

      expect(added).toBe(fixture.newCourses.length)
      const courses = await service.listJoinableCourses()
      const standing = new Map(courses.map((course) => [course.id, course.membership]))
      for (const id of fixture.newCourses) expect(standing.get(id)).toBe('enrolled')
      // Completed and archived courses are not in use: they are not joined (archived ones are not
      // even listed).
      expect(standing.get(fixture.completedCourse)).toBeUndefined()
      expect(standing.get(fixture.archivedCourse)).toBeUndefined()
    })

    // Proves the programme is remembered as the student's own.
    it('marks the programme as the student’s own', async () => {
      const { service } = create()

      await service.joinProgramme(fixture.open)

      const programmes = await service.listJoinableProgrammes()
      expect(programmes.find((programme) => programme.id === fixture.open)?.isMine).toBe(true)
    })

    // Proves joining twice is harmless: the second time adds nothing.
    it('adds nothing when the student joins again', async () => {
      const { service } = create()
      await service.joinProgramme(fixture.open)

      await expect(service.joinProgramme(fixture.open)).resolves.toBe(0)
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

      await expect(service.joinProgramme(id)).rejects.toMatchObject({
        kind: 'validation',
        message: "This programme isn't open.",
      })
    })
  })
}
