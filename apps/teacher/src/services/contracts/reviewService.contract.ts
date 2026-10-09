/**
 * The rules every ReviewService implementation must follow, run against the demo now and the
 * Supabase service later (ENGINEERING_STANDARDS.md 2.4). Written so the student portal's summary
 * service and the backend read the same statuses (D73).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The records a test builds.
import {
  classRecord,
  courseRecord,
  emptyPlatformData,
  summaryRecord,
  userRecord,
  type PlatformData,
} from '../platformData'
// The interface under test, and the draft's shape.
import type { ReviewService } from '../types'
import type { SummaryDraft } from '@/types/review'

/** Builds a service over `data`, acting as the teacher `actorId` (null: signed out) at `now`. */
export type ReviewServiceFactory = (
  data: PlatformData,
  actorId: string | null,
  now: Date,
) => ReviewService

/** The moment every contract test runs at. */
const NOW = new Date('2026-10-12T10:00:00.000Z')

/** The one item of `items`; fails the test when there isn't one (no non-null assertion needed). */
function only<T>(items: T[]): T {
  const item = items[0]
  if (item === undefined) throw new Error('Expected an item')
  return item
}

/** A valid draft. */
const DRAFT: SummaryDraft = {
  overview: 'Vectors and spaces.',
  keyConcepts: [{ id: 'c1', title: 'Basis', explanation: 'A minimal spanning set.' }],
  confusionAreas: [{ id: 'f1', issue: 'Span vs basis', clarification: 'A basis is independent.' }],
  keyTopics: [{ id: 't1', name: 'Rank', description: '' }],
}

/** A platform with teacher t1's live course, one class and its summary in `status`. */
function platform(status: 'collecting' | 'processing' | 'in_review' | 'published' = 'in_review') {
  return emptyPlatformData({
    users: [userRecord({ id: 't1', role: 'teacher', fullName: 'Sarah Mbarga' })],
    courses: [
      courseRecord({ id: 'c1', code: 'MTH 202', title: 'Linear Algebra', teacherId: 't1' }),
    ],
    classes: [classRecord({ id: 'k1', courseId: 'c1', number: 4, title: 'Week 4' })],
    summaries: [
      summaryRecord({
        id: 's1',
        classId: 'k1',
        status,
        inReviewSince: status === 'in_review' ? '2026-10-07T12:00:00.000Z' : null,
        draft: { ...DRAFT, overview: 'AI draft.' },
        notesAnalyzedCount: 18,
        studentCount: 14,
      }),
    ],
  })
}

/** Registers the contract's tests for the implementation `create` builds. */
export function describeReviewServiceContract(name: string, create: ReviewServiceFactory) {
  describe(`ReviewService contract (${name})`, () => {
    describe('listReviewQueue', () => {
      // Proves the queue holds only the teacher's own live summaries in review, oldest wait first.
      it('lists the teacher’s summaries in review, longest wait first', async () => {
        const data = emptyPlatformData({
          courses: [
            courseRecord({ id: 'mine', code: 'M 1', teacherId: 't1' }),
            courseRecord({ id: 'theirs', teacherId: 't2' }),
            courseRecord({ id: 'old', teacherId: 't1', archivedAt: '2026-01-01T00:00:00.000Z' }),
          ],
          classes: [
            classRecord({ id: 'a', courseId: 'mine', number: 1 }),
            classRecord({ id: 'b', courseId: 'mine', number: 2 }),
            classRecord({ id: 'c', courseId: 'mine', number: 3 }),
            classRecord({
              id: 'd',
              courseId: 'mine',
              number: 4,
              archivedAt: '2026-01-01T00:00:00.000Z',
            }),
            classRecord({ id: 'e', courseId: 'theirs', number: 1 }),
            classRecord({ id: 'f', courseId: 'old', number: 1 }),
          ],
          summaries: [
            summaryRecord({
              id: 'sa',
              classId: 'a',
              status: 'in_review',
              inReviewSince: '2026-10-10T09:00:00.000Z',
              notesAnalyzedCount: 7,
            }),
            summaryRecord({
              id: 'sb',
              classId: 'b',
              status: 'in_review',
              inReviewSince: '2026-10-05T09:00:00.000Z',
            }),
            summaryRecord({ id: 'sc', classId: 'c', status: 'published' }),
            summaryRecord({
              id: 'sd',
              classId: 'd',
              status: 'in_review',
              inReviewSince: '2026-10-01T09:00:00.000Z',
            }),
            summaryRecord({
              id: 'se',
              classId: 'e',
              status: 'in_review',
              inReviewSince: '2026-10-01T09:00:00.000Z',
            }),
            summaryRecord({
              id: 'sf',
              classId: 'f',
              status: 'in_review',
              inReviewSince: '2026-10-01T09:00:00.000Z',
            }),
          ],
        })
        const queue = await create(data, 't1', NOW).listReviewQueue()
        expect(queue.map((item) => item.summaryId)).toEqual(['sb', 'sa'])
        expect(queue[1]).toMatchObject({
          courseId: 'mine',
          courseCode: 'M 1',
          classNumber: 1,
          inReviewSince: '2026-10-10T09:00:00.000Z',
          notesAnalyzedCount: 7,
        })
      })

      // Proves an empty queue is an empty list, and a signed-out caller is refused.
      it('is empty when nothing waits, and refuses a signed-out caller', async () => {
        await expect(create(platform('published'), 't1', NOW).listReviewQueue()).resolves.toEqual(
          [],
        )
        await expect(create(platform(), null, NOW).listReviewQueue()).rejects.toMatchObject({
          kind: 'unauthorized',
        })
      })
    })

    describe('getDraft', () => {
      // Proves a summary opens with its draft, counts and where it is.
      it('returns the summary in review', async () => {
        const details = await create(platform(), 't1', NOW).getDraft('s1')
        expect(details).toMatchObject({
          summaryId: 's1',
          courseId: 'c1',
          courseCode: 'MTH 202',
          courseTitle: 'Linear Algebra',
          classNumber: 4,
          classTitle: 'Week 4',
          status: 'in_review',
          version: 1,
          notesAnalyzedCount: 18,
          studentCount: 14,
          publishedAt: null,
          reviewedBy: null,
        })
        expect(details.draft.overview).toBe('AI draft.')
      })

      // Proves a published summary opens read-only with who published it and when.
      it('returns a published summary with its publisher and time', async () => {
        const data = platform('published')
        const summary = only(data.summaries)
        summary.publishedAt = '2026-10-09T08:00:00.000Z'
        summary.reviewedBy = 't1'
        const details = await create(data, 't1', NOW).getDraft('s1')
        expect(details).toMatchObject({
          status: 'published',
          publishedAt: '2026-10-09T08:00:00.000Z',
          reviewedBy: 'Sarah Mbarga',
        })
      })

      // Proves a summary not yet in review still opens, so the screen can say where it is.
      it.each(['collecting', 'processing'] as const)('opens a %s summary', async (status) => {
        const details = await create(platform(status), 't1', NOW).getDraft('s1')
        expect(details.status).toBe(status)
      })

      // SECURITY: proves another teacher's, an archived-course, an archived-class and an unknown
      // summary all answer the same not_found, and a signed-out caller is refused.
      it('answers not_found unless the summary is the teacher’s own and live', async () => {
        const other = platform()
        only(other.courses).teacherId = 't2'
        const archivedCourse = platform()
        only(archivedCourse.courses).archivedAt = '2026-01-01T00:00:00.000Z'
        const archivedClass = platform()
        only(archivedClass.classes).archivedAt = '2026-01-01T00:00:00.000Z'
        for (const data of [other, archivedCourse, archivedClass]) {
          await expect(create(data, 't1', NOW).getDraft('s1')).rejects.toMatchObject({
            kind: 'not_found',
          })
        }
        await expect(create(platform(), 't1', NOW).getDraft('nope')).rejects.toMatchObject({
          kind: 'not_found',
        })
        await expect(create(platform(), null, NOW).getDraft('s1')).rejects.toMatchObject({
          kind: 'unauthorized',
        })
      })
    })

    describe('saveDraft', () => {
      // Proves a save keeps the text (trimmed), raises the version and leaves the stage alone.
      it('saves the draft and raises the version', async () => {
        const service = create(platform(), 't1', NOW)
        const saved = await service.saveDraft('s1', { ...DRAFT, overview: '  Edited.  ' }, 1)
        expect(saved).toMatchObject({ status: 'in_review', version: 2 })
        expect(saved.draft.overview).toBe('Edited.')
        // A fresh read sees it.
        await expect(service.getDraft('s1')).resolves.toMatchObject({
          version: 2,
          draft: { overview: 'Edited.' },
        })
      })

      // Proves a stale version is refused and changes nothing, so a second tab can't overwrite.
      it('refuses a stale version and keeps the newer draft', async () => {
        const service = create(platform(), 't1', NOW)
        await service.saveDraft('s1', { ...DRAFT, overview: 'First.' }, 1)
        await expect(
          service.saveDraft('s1', { ...DRAFT, overview: 'Stale.' }, 1),
        ).rejects.toMatchObject({ kind: 'conflict' })
        await expect(service.getDraft('s1')).resolves.toMatchObject({
          draft: { overview: 'First.' },
        })
      })

      // Proves a blank required field is refused, and nothing is saved.
      it('refuses a blank required field', async () => {
        const service = create(platform(), 't1', NOW)
        await expect(
          service.saveDraft('s1', { ...DRAFT, overview: '   ' }, 1),
        ).rejects.toMatchObject({ kind: 'validation', message: 'Enter the overview.' })
        await expect(service.getDraft('s1')).resolves.toMatchObject({ version: 1 })
      })

      // Proves only a summary in review can change: every other stage refuses with conflict.
      it.each(['collecting', 'processing', 'published'] as const)(
        'refuses to change a %s summary',
        async (status) => {
          await expect(
            create(platform(status), 't1', NOW).saveDraft('s1', DRAFT, 1),
          ).rejects.toMatchObject({ kind: 'conflict' })
        },
      )

      // SECURITY: proves another teacher's summary can't be changed, and signed-out can't either.
      it('refuses another teacher and a signed-out caller', async () => {
        const other = platform()
        only(other.courses).teacherId = 't2'
        await expect(create(other, 't1', NOW).saveDraft('s1', DRAFT, 1)).rejects.toMatchObject({
          kind: 'not_found',
        })
        await expect(create(platform(), null, NOW).saveDraft('s1', DRAFT, 1)).rejects.toMatchObject(
          {
            kind: 'unauthorized',
          },
        )
      })
    })

    describe('approveAndPublish', () => {
      // Proves publishing saves the given text, sets the stage, time and publisher, and the
      // summary leaves the queue.
      it('saves the draft and publishes it', async () => {
        const service = create(platform(), 't1', NOW)
        const published = await service.approveAndPublish('s1', { ...DRAFT, overview: 'Final.' }, 1)
        expect(published).toMatchObject({
          status: 'published',
          publishedAt: NOW.toISOString(),
          reviewedBy: 'Sarah Mbarga',
          version: 2,
        })
        expect(published.draft.overview).toBe('Final.')
        await expect(service.listReviewQueue()).resolves.toEqual([])
      })

      // Proves a stale version or an invalid draft publishes nothing.
      it('publishes nothing for a stale version or an invalid draft', async () => {
        const service = create(platform(), 't1', NOW)
        await service.saveDraft('s1', DRAFT, 1)
        await expect(service.approveAndPublish('s1', DRAFT, 1)).rejects.toMatchObject({
          kind: 'conflict',
        })
        await expect(
          service.approveAndPublish('s1', { ...DRAFT, overview: '' }, 2),
        ).rejects.toMatchObject({ kind: 'validation' })
        await expect(service.getDraft('s1')).resolves.toMatchObject({ status: 'in_review' })
      })

      // Proves a second publish is refused: a published summary can't change.
      it('refuses to publish twice', async () => {
        const service = create(platform(), 't1', NOW)
        await service.approveAndPublish('s1', DRAFT, 1)
        await expect(service.approveAndPublish('s1', DRAFT, 2)).rejects.toMatchObject({
          kind: 'conflict',
        })
      })

      // Proves a summary not yet in review can't be published, however it is asked.
      it.each(['collecting', 'processing'] as const)('refuses a %s summary', async (status) => {
        await expect(
          create(platform(status), 't1', NOW).approveAndPublish('s1', DRAFT, 1),
        ).rejects.toMatchObject({ kind: 'conflict' })
      })

      // SECURITY: proves only the course's teacher can publish, and only when signed in.
      it('refuses another teacher and a signed-out caller', async () => {
        const other = platform()
        only(other.courses).teacherId = 't2'
        await expect(
          create(other, 't1', NOW).approveAndPublish('s1', DRAFT, 1),
        ).rejects.toMatchObject({ kind: 'not_found' })
        await expect(
          create(platform(), null, NOW).approveAndPublish('s1', DRAFT, 1),
        ).rejects.toMatchObject({ kind: 'unauthorized' })
      })
    })
  })
}
