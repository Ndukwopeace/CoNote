/**
 * The teacher app's service interfaces: everything the UI may ask of the backend. Pages reach
 * them only through useServices(), so the demo data and Supabase are interchangeable.
 */

// Session shapes.
import type { PasswordResetRequest, Session, SignInInput } from '@conote/portal'
// Review shapes.
import type { ReviewDetails, ReviewQueueItem, SummaryDraft } from '@/types/review'
// Course shapes.
import type { CourseDetails, TeacherCourse } from '@/types/teaching'

/** Signing in and out, and the current session. Same contract as the admin app's. */
export interface AuthService {
  /** The stored session, or null when signed out. */
  getSession(): Promise<Session | null>
  /** Signs in; rejects with a validation AppError for wrong details, never saying which was wrong. */
  signIn(input: SignInInput): Promise<Session>
  /** Signs out and forgets the session. */
  signOut(): Promise<void>
  /**
   * Asks for a reset link for `email`. Resolves the same way whether or not an account exists;
   * rejects only for a malformed email.
   */
  requestPasswordReset(email: string): Promise<PasswordResetRequest>
  /** Whether `code` is the newest, unused reset code. */
  checkResetLink(code: string | null): Promise<boolean>
  /** Sets a new password with `code`, checking both again; the code then stops working. */
  resetPassword(code: string, newPassword: string): Promise<void>
  /** Calls `listener` whenever the session changes. Returns a function that stops listening. */
  onAuthChange(listener: (session: Session | null) => void): () => void
}

/**
 * The signed-in teacher's courses (teacher REQUIREMENTS section 10). A teacher sees only the
 * courses they teach.
 */
export interface TeachingService {
  /**
   * The courses the signed-in teacher teaches, archived ones left out: ongoing first, then
   * upcoming, then completed, by code within each. Rejects with unauthorized when signed out.
   */
  listMyCourses(): Promise<TeacherCourse[]>
  /**
   * One of the teacher's courses with its classes, newest first. Rejects with not_found for an
   * unknown, archived or another teacher's course, and unauthorized when signed out.
   */
  getMyCourse(courseId: string): Promise<CourseDetails>
}

/**
 * Reviewing and publishing summaries (teacher REQUIREMENTS sections 8 to 10). Only a summary in
 * `in_review` can change, and only its course's teacher can change it. `approveAndPublish` is the
 * one publish path. In the backend stage the writes run server-side and check the same rules.
 */
export interface ReviewService {
  /** The teacher's summaries in review, oldest wait first. */
  listReviewQueue(): Promise<ReviewQueueItem[]>
  /**
   * A summary opened for review, in any stage. Rejects with not_found unless it belongs to a
   * live class of one of the teacher's live courses.
   */
  getDraft(summaryId: string): Promise<ReviewDetails>
  /**
   * Saves `draft`. Rejects with validation for a blank required field, and with conflict when
   * `version` is stale or the summary is not in review. Returns the saved summary.
   */
  saveDraft(summaryId: string, draft: SummaryDraft, version: number): Promise<ReviewDetails>
  /**
   * Saves `draft` and publishes it in one step, with the same checks as `saveDraft`. Sets who
   * published it and when. Returns the published summary.
   */
  approveAndPublish(summaryId: string, draft: SummaryDraft, version: number): Promise<ReviewDetails>
}

/** Every service the teacher app uses. Grows with each milestone. */
export interface Services {
  auth: AuthService
  teaching: TeachingService
  review: ReviewService
}
