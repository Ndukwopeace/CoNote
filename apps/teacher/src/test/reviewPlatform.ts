/**
 * A small platform for the review screens' tests: the test teacher's course, one class, and its
 * summary in the stage the test asks for.
 */

// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'

// Records to build a platform from.
import {
  classRecord,
  courseRecord,
  emptyPlatformData,
  summaryRecord,
  userRecord,
  type PlatformData,
} from '@/services/platformData'

/** The signed-in teacher's ID, as makeSession builds it. */
export const ME = 'teacher-test'

/** The platform: summary `s1` of class 4 of MTH 202, in `status`. */
export function reviewPlatform(status: SummaryStatus = 'in_review'): PlatformData {
  return emptyPlatformData({
    users: [userRecord({ id: ME, role: 'teacher', fullName: 'Sarah Mbarga' })],
    courses: [
      courseRecord({ id: 'mth-202', code: 'MTH 202', title: 'Linear Algebra', teacherId: ME }),
    ],
    classes: [
      classRecord({
        id: 'k4',
        courseId: 'mth-202',
        number: 4,
        title: 'Basis and dimension',
        noteCount: 18,
      }),
    ],
    summaries: [
      summaryRecord({
        id: 's1',
        classId: 'k4',
        status,
        inReviewSince: status === 'in_review' ? '2026-10-07T12:00:00.000Z' : null,
        publishedAt: status === 'published' ? '2026-10-09T08:00:00.000Z' : null,
        reviewedBy: status === 'published' ? ME : null,
        notesAnalyzedCount: 18,
        studentCount: 14,
        draft: {
          overview: 'The AI overview.',
          keyConcepts: [{ id: 'c1', title: 'Basis', explanation: 'A minimal spanning set.' }],
          confusionAreas: [
            { id: 'f1', issue: 'Span versus basis', clarification: 'A basis is also independent.' },
          ],
          keyTopics: [{ id: 't1', name: 'Dimension', description: 'Size of a basis.' }],
        },
      }),
    ],
  })
}
