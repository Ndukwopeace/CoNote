/**
 * The demo ReviewService (teacher REQUIREMENTS sections 8 to 10): the review queue, and saving and
 * publishing a draft, over the demo platform records with the rules the database will enforce.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'

// The draft's rules.
import { draftSchema } from '@/lib/draftSchema'
// The shapes returned.
import type { ReviewDetails, ReviewQueueItem } from '@/types/review'

// The records it reads and changes.
import type { ClassRecord, CourseRecord, PlatformData, SummaryRecord } from '../platformData'
// The interface implemented here.
import type { ReviewService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'

/** What the demo service needs: the records, who is signed in, the clock, and how slow to be. */
interface MockReviewOptions {
  data: PlatformData
  // The signed-in teacher's ID, or null when signed out.
  actorId: () => string | null
  now: () => Date
  latencyMs: number
  // Called after every change, so the demo can save it.
  onChange?: () => void
}

/** What every "no such summary" answers, whatever the reason, so the answer reveals nothing. */
const SUMMARY_NOT_FOUND = "We couldn't find that summary."

/** The message for a draft that changed, or is no longer in review. */
const STALE_DRAFT = 'This draft changed. Reload to see the latest.'

/** A summary with the class and course it belongs to. */
interface Located {
  summary: SummaryRecord
  cls: ClassRecord
  course: CourseRecord
}

/** Builds the demo ReviewService over `data`. */
export function createMockReviewService({
  data,
  actorId,
  now,
  latencyMs,
  onChange,
}: MockReviewOptions): ReviewService {
  /** The signed-in teacher's ID; rejects when signed out. */
  function requireTeacher(): string {
    const teacherId = actorId()
    // SECURITY: no session, no summaries.
    if (teacherId === null) throw new AppError('unauthorized', 'Sign in to review summaries.')
    return teacherId
  }

  /** The summary with its class and course, only if it is the teacher's own and live. */
  function locate(summaryId: string, teacherId: string): Located {
    const summary = data.summaries.find((candidate) => candidate.id === summaryId)
    const cls = data.classes.find((candidate) => candidate.id === summary?.classId)
    const course = data.courses.find((candidate) => candidate.id === cls?.courseId)
    // SECURITY: another teacher's, an archived and an unknown summary all answer the same, so a
    // teacher can't find out which summary IDs exist or read a course they don't teach.
    if (
      !summary ||
      !cls ||
      course?.teacherId !== teacherId ||
      course.archivedAt !== null ||
      cls.archivedAt !== null
    ) {
      throw new AppError('not_found', SUMMARY_NOT_FOUND)
    }
    return { summary, cls, course }
  }

  /** The summary as the review screen shows it. */
  function details({ summary, cls, course }: Located): ReviewDetails {
    return {
      summaryId: summary.id,
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      classNumber: cls.number,
      classTitle: cls.title,
      status: summary.status,
      version: summary.version,
      draft: summary.draft,
      notesAnalyzedCount: summary.notesAnalyzedCount,
      studentCount: summary.studentCount,
      inReviewSince: summary.inReviewSince,
      publishedAt: summary.publishedAt,
      reviewedBy: data.users.find((user) => user.id === summary.reviewedBy)?.fullName ?? null,
    }
  }

  /**
   * Checks a change may happen and returns the cleaned draft: the draft is valid, the summary is
   * in review, and `version` is the one the teacher loaded.
   */
  function checkChange(found: Located, draft: unknown, version: number) {
    // SECURITY: the same rules as the form, enforced here too.
    const parsed = draftSchema.safeParse(draft)
    if (!parsed.success) {
      throw new AppError('validation', parsed.error.issues[0]?.message ?? 'Check the draft.')
    }
    // Only a summary in review can change; any other stage, or a newer version, is a conflict.
    if (found.summary.status !== 'in_review' || found.summary.version !== version) {
      throw new AppError('conflict', STALE_DRAFT)
    }
    return parsed.data
  }

  return {
    async listReviewQueue() {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      const teacherId = requireTeacher()
      const queue: ReviewQueueItem[] = []
      for (const summary of data.summaries) {
        // Only summaries waiting for the teacher.
        if (summary.status !== 'in_review' || summary.inReviewSince === null) continue
        // Only the teacher's own live ones.
        let found: Located
        try {
          found = locate(summary.id, teacherId)
        } catch {
          continue
        }
        queue.push({
          summaryId: summary.id,
          courseId: found.course.id,
          courseCode: found.course.code,
          classNumber: found.cls.number,
          classTitle: found.cls.title,
          inReviewSince: summary.inReviewSince,
          notesAnalyzedCount: summary.notesAnalyzedCount,
        })
      }
      // The longest wait first.
      return queue.sort((a, b) => Date.parse(a.inReviewSince) - Date.parse(b.inReviewSince))
    },

    async getDraft(summaryId) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      return details(locate(summaryId, requireTeacher()))
    },

    async saveDraft(summaryId, draft, version) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      const found = locate(summaryId, requireTeacher())
      const clean = checkChange(found, draft, version)
      // Keep the text and raise the version; the stage stays.
      found.summary.draft = clean
      found.summary.version += 1
      onChange?.()
      return details(found)
    },

    async approveAndPublish(summaryId, draft, version) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      const teacherId = requireTeacher()
      const found = locate(summaryId, teacherId)
      const clean = checkChange(found, draft, version)
      // Save the text, then publish it: one step, so a draft can't be published unsaved.
      found.summary.draft = clean
      found.summary.version += 1
      found.summary.status = 'published'
      found.summary.publishedAt = now().toISOString()
      found.summary.reviewedBy = teacherId
      onChange?.()
      return details(found)
    },
  }
}
