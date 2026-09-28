/**
 * Service interfaces (REQUIREMENTS.md section 12.1). UI code depends on these, never on an
 * implementation. More services join the registry as the milestones that need them land.
 */

// The course, class, note, summary and notification shapes.
import type { AppNotification, ClassSession, Course, ID, Note, Summary } from '@/types/domain'
// The auth data shapes the interface methods accept and return.
import type {
  OAuthProvider,
  PasswordResetRequest,
  Session,
  SignInInput,
  SignUpInput,
} from '@/types/auth'

/** Everything the app can ask of an authentication backend (mock today, Supabase later). */
export interface AuthService {
  /** The current session, or null when nobody is signed in. */
  getSession(): Promise<Session | null>
  /** Signs in with email and password; rejects with a validation AppError on bad input. */
  signIn(input: SignInInput): Promise<Session>
  /** Creates a student account and signs it in. */
  signUp(input: SignUpInput): Promise<Session>
  /** Signs in through Google (decision D38). */
  signInWithProvider(provider: OAuthProvider): Promise<Session>
  /** Ends the session. */
  signOut(): Promise<void>
  /**
   * Sends a reset link. Must resolve the same way whether or not the account exists.
   * The demo also returns the link itself, because it sends no email.
   */
  requestPasswordReset(email: string): Promise<PasswordResetRequest>
  /**
   * True when `code` (from the reset link) is still valid. Used and superseded codes are
   * refused. A missing code is always refused.
   */
  checkResetLink(code: string | null): Promise<boolean>
  /**
   * Sets a new password from a reset link. The code is checked again here, not only when the
   * page opened, and is spent on success. Rejects with a validation error when the code is no
   * longer valid or the password breaks the rules.
   */
  resetPassword(code: string, newPassword: string): Promise<void>
  /** Changes the password of the signed-in student (Settings → Account, M5). */
  updatePassword(newPassword: string): Promise<void>
  /** Calls `listener` whenever the session changes. Returns an unsubscribe function. */
  onAuthChange(listener: (session: Session | null) => void): () => void
}

/** The student's enrolled courses (FR-CRS). Unknown IDs reject with a not_found AppError. */
export interface CourseService {
  /** Every course the student is enrolled in, in display order. */
  listMyCourses(): Promise<Course[]>
  /** One enrolled course. */
  getCourse(courseId: ID): Promise<Course>
}

/** Class sessions (FR-CLS). Unknown IDs reject with a not_found AppError. */
export interface ClassService {
  /** One course's classes, in class-number order. */
  listClasses(courseId: ID): Promise<ClassSession[]>
  /** Every class across the student's enrolled courses, soonest first. */
  listMyClasses(): Promise<ClassSession[]>
  /** One class. */
  getClass(classId: ID): Promise<ClassSession>
}

/** Narrows a note list to one course or one class. */
export interface NoteFilter {
  // Only notes for this course.
  courseId?: ID
  // Only notes for this class.
  classId?: ID
}

/** The student's own notes. Reading only in M3; writing arrives in M4. */
export interface NoteService {
  /** The signed-in student's notes, newest first. Never anyone else's (RLS, section 12.2). */
  listMyNotes(filter?: NoteFilter): Promise<Note[]>
}

/** Published summaries. The rest of the interface arrives in M5. */
export interface SummaryService {
  /** Published summaries only, newest first; draft content never reaches the client. */
  listPublished(filter?: { courseId?: ID }): Promise<Summary[]>
}

/** The student's notifications. Reading only in M3; marking as read arrives in M5. */
export interface NotificationService {
  /** Newest first. */
  list(): Promise<AppNotification[]>
  /** How many are unread, for the bell's badge. */
  unreadCount(): Promise<number>
}

/** The full set of services the app receives through ServicesProvider. */
export interface Services {
  // Authentication.
  auth: AuthService
  // Enrolled courses.
  courses: CourseService
  // Class sessions.
  classes: ClassService
  // The student's notes.
  notes: NoteService
  // Published summaries.
  summaries: SummaryService
  // Notifications.
  notifications: NotificationService
}
