/**
 * The contract every SummaryService must meet (FR-SUM). The mock runs it today; the Supabase
 * implementation runs the same file against a real database in CI (ENGINEERING_STANDARDS.md 2.5).
 * Only summaries a teacher has approved may ever reach a student (REQUIREMENTS section 4).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The interfaces under test.
import type { Services } from '../types'

/** The classes an implementation's fixture must hold. */
export interface SummaryFixture {
  // Classes of the student's courses whose summary is not published (any other stage, or none).
  unpublished: readonly string[]
}

/** The demo's classes. */
export const MOCK_SUMMARY_FIXTURE: SummaryFixture = {
  unpublished: ['swe-311-c3', 'cse-205-c1', 'swe-311-c4'],
}

// A well-formed ID that no record has, so databases that use UUIDs are tested with one too.
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

/** What an implementation's test file passes in. */
interface SummaryContractOptions {
  /** The class IDs the fixture uses; defaults to the demo's. */
  fixture?: SummaryFixture
  /** Builds a fresh set of services for an enrolled student with published summaries. */
  create: () => Pick<Services, 'summaries' | 'classes'>
}

/** Behaviour every implementation of the summary service shares. */
export function runSummaryServiceContract(
  name: string,
  { create, fixture = MOCK_SUMMARY_FIXTURE }: SummaryContractOptions,
) {
  describe(`Summary service contract: ${name}`, () => {
    // SECURITY: proves only summaries of published classes are ever returned (section 4).
    it('returns summaries only for published classes', async () => {
      // Arrange.
      const services = create()
      const summaries = await services.summaries.listPublished()

      // Assert: there are some, and each one's class is published.
      expect(summaries.length).toBeGreaterThan(0)
      for (const summary of summaries) {
        const session = await services.classes.getClass(summary.classId)
        expect(session.summaryStatus).toBe('published')
      }
    })

    // Proves a summary carries what the page shows, including who approved it.
    it('describes who approved each summary and when', async () => {
      const [first] = await create().summaries.listPublished()

      expect(first?.reviewedBy.fullName).not.toBe('')
      expect(Number.isNaN(Date.parse(first?.publishedAt ?? ''))).toBe(false)
      expect(first?.notesAnalyzedCount).toBeGreaterThanOrEqual(0)
    })

    // Proves the newest published summary comes first.
    it('lists the newest first', async () => {
      const summaries = await create().summaries.listPublished()

      const times = summaries.map((s) => Date.parse(s.publishedAt))
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })

    // Proves the course filter narrows the list.
    it('filters by course', async () => {
      // Arrange.
      const { summaries } = create()
      const [first] = await summaries.listPublished()

      // Act.
      const narrowed = await summaries.listPublished({ courseId: first?.courseId ?? '' })

      // Assert.
      expect(narrowed.length).toBeGreaterThan(0)
      expect(narrowed.every((s) => s.courseId === first?.courseId)).toBe(true)
      await expect(summaries.listPublished({ courseId: 'no-such-course' })).resolves.toEqual([])
    })

    // Proves a published summary can be read by its class.
    it('reads a published summary by class', async () => {
      // Arrange.
      const { summaries } = create()
      const [first] = await summaries.listPublished()

      // Act and assert.
      await expect(summaries.getByClass(first?.classId ?? '')).resolves.toEqual(first)
    })

    // SECURITY: proves a class whose summary isn't published returns not_found, never a draft.
    it('reports an unpublished or unknown class as not_found', async () => {
      const { summaries } = create()
      const ids = [...fixture.unpublished, 'no-such-class', UNKNOWN_UUID]

      await Promise.all(
        ids.map((id) =>
          expect(summaries.getByClass(id)).rejects.toMatchObject({ kind: 'not_found' }),
        ),
      )
    })

    // Proves marking a summary as viewed sticks (FR-SUM-5), and doing it twice is harmless.
    it('marks a summary as viewed', async () => {
      // Arrange.
      const { summaries } = create()
      const unviewed = (await summaries.listPublished()).find((s) => !s.viewedByMe)
      expect(unviewed).toBeDefined()

      // Act.
      await summaries.markViewed(unviewed?.id ?? '')
      await summaries.markViewed(unviewed?.id ?? '')

      // Assert.
      const after = await summaries.getByClass(unviewed?.classId ?? '')
      expect(after.viewedByMe).toBe(true)
    })

    // Proves an unknown summary cannot be marked.
    it.each(['no-such-summary', UNKNOWN_UUID])(
      'reports an unknown summary %s as not_found when marking it viewed',
      async (id) => {
        await expect(create().summaries.markViewed(id)).rejects.toMatchObject({
          kind: 'not_found',
        })
      },
    )
  })
}
