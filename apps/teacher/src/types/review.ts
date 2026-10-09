/**
 * What the review screens show and edit (teacher REQUIREMENTS sections 8 and 9). The draft has the
 * parts the student portal's summary view has (student REQUIREMENTS FR-SUM-2), so what a teacher
 * publishes is what a student reads.
 */

// The shared vocabulary.
import type { SummaryStatus } from '@conote/domain'

/** One main idea and its explanation. */
export interface KeyConcept {
  id: string
  title: string
  explanation: string
}

/** One point students were confused about, and the clarification. */
export interface ConfusionArea {
  id: string
  issue: string
  clarification: string
}

/** One topic of the class; the description may be empty. */
export interface KeyTopic {
  id: string
  name: string
  description: string
}

/** The text of a summary: all of it editable, all of it plain text. */
export interface SummaryDraft {
  overview: string
  keyConcepts: KeyConcept[]
  confusionAreas: ConfusionArea[]
  keyTopics: KeyTopic[]
}

/** One summary waiting in the review queue. */
export interface ReviewQueueItem {
  summaryId: string
  courseId: string
  courseCode: string
  classNumber: number
  classTitle: string
  // When it entered review: the queue is ordered by it, oldest first.
  inReviewSince: string
  // How many notes it was written from.
  notesAnalyzedCount: number
}

/** A summary opened for review. */
export interface ReviewDetails {
  summaryId: string
  courseId: string
  courseCode: string
  courseTitle: string
  classNumber: number
  classTitle: string
  status: SummaryStatus
  // Changes with every save, so a stale tab can't overwrite a newer draft.
  version: number
  draft: SummaryDraft
  // "Based on {notesAnalyzedCount} notes from {studentCount} students" (D74): counts, never notes.
  notesAnalyzedCount: number
  studentCount: number
  // When it entered review, or null if it hasn't.
  inReviewSince: string | null
  // When it was published, and by whom, or null while unpublished.
  publishedAt: string | null
  reviewedBy: string | null
}
