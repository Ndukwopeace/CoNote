/**
 * Service interfaces (REQUIREMENTS.md section 12.1). UI code depends on these, never on an
 * implementation. More services join the registry as the milestones that need them land.
 */

// What a student submits for a note.
import type { NoteInput } from '@/lib/notes'
// The course, class, note, summary and notification shapes.
import type {
  AiContext,
  AiMessage,
  AppNotification,
  ClassSession,
  Course,
  Note,
  NotificationPrefs,
  StudentProfile,
  Summary,
} from '@/types/domain'
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
  /**
   * Changes the signed-in student's password (Settings → Account). The current password is
   * required, so someone at an unlocked computer can't take over the account.
   */
  updatePassword(currentPassword: string, newPassword: string): Promise<void>
  /** Calls `listener` whenever the session changes. Returns an unsubscribe function. */
  onAuthChange(listener: (session: Session | null) => void): () => void
}

/** The student's enrolled courses (FR-CRS). Unknown IDs reject with a not_found AppError. */
export interface CourseService {
  /** Every course the student is enrolled in, in display order. */
  listMyCourses(): Promise<Course[]>
  /** One enrolled course. */
  getCourse(courseId: string): Promise<Course>
}

/** Class sessions (FR-CLS). Unknown IDs reject with a not_found AppError. */
export interface ClassService {
  /** One course's classes, in class-number order. */
  listClasses(courseId: string): Promise<ClassSession[]>
  /** Every class across the student's enrolled courses, soonest first. */
  listMyClasses(): Promise<ClassSession[]>
  /** One class. */
  getClass(classId: string): Promise<ClassSession>
}

/** Narrows a note list to one course or one class. */
export interface NoteFilter {
  // Only notes for this course.
  courseId?: string
  // Only notes for this class.
  classId?: string
}

/**
 * The student's own notes. Unknown IDs reject with a not_found AppError; input that breaks the
 * note rules (lib/notes.ts) rejects with a validation AppError whose message can be shown as is.
 */
export interface NoteService {
  /** The signed-in student's notes, newest first. Never anyone else's (RLS, section 12.2). */
  listMyNotes(filter?: NoteFilter): Promise<Note[]>
  /** One of the student's notes. */
  getNote(noteId: string): Promise<Note>
  /** Creates a note for one of the student's classes. A blank title becomes the first line. */
  createNote(input: NoteInput): Promise<Note>
  /** Replaces a note's class, title, body and tags. */
  updateNote(noteId: string, input: NoteInput): Promise<Note>
  /** Deletes a note for good (FR-NTE-8). */
  deleteNote(noteId: string): Promise<void>
}

/** Published summaries. Draft content never reaches the client (section 4). */
export interface SummaryService {
  /** Published summaries only, newest first. */
  listPublished(filter?: { courseId?: string }): Promise<Summary[]>
  /** The published summary of one class; not_found when the class has none published. */
  getByClass(classId: string): Promise<Summary>
  /** Records that the student opened a summary (FR-SUM-5). */
  markViewed(summaryId: string): Promise<void>
}

/** The student's notifications. Unknown IDs reject with a not_found AppError. */
export interface NotificationService {
  /** Newest first. */
  list(): Promise<AppNotification[]>
  /** How many are unread, for the bell's badge. */
  unreadCount(): Promise<number>
  /** Marks one as read (FR-NTF-3). */
  markRead(notificationId: string): Promise<void>
  /** Marks every one as read (FR-NTF-3). */
  markAllRead(): Promise<void>
}

/**
 * Ask CoNote AI (FR-AI). One call per question, with the whole conversation so far, so a later
 * backend can answer from context and stream without the UI changing shape (FR-AI-7).
 */
export interface AiService {
  /** The assistant's reply to the last user message in `messages`. */
  askAi(context: AiContext, messages: AiMessage[]): Promise<string>
}

/** Profile fields a student can change; any left out stay as they are. */
export interface ProfileUpdate {
  // Display name.
  fullName?: string
  // Department.
  department?: string
  // Level or year.
  level?: string
  // Phone number.
  phone?: string
  // A picture address returned by uploadAvatar.
  avatarUrl?: string
  // Notification settings (FR-SET-3).
  notificationPrefs?: NotificationPrefs
}

/** The signed-in student's profile (FR-SET-1, FR-SET-3). */
export interface ProfileService {
  /** The profile; unauthorized when nobody is signed in. */
  getMe(): Promise<StudentProfile>
  /** Saves changes and returns the whole profile; validation errors can be shown as is. */
  updateMe(changes: ProfileUpdate): Promise<StudentProfile>
  /** Stores a JPG or PNG of 2 MB or less and returns its address, for updateMe. */
  uploadAvatar(file: File): Promise<string>
}

/** Demo-only actions. Present only in mock mode, so the UI can hide them otherwise. */
export interface DemoService {
  /** Deletes every demo change so the seed data returns (FR-SET-5). */
  resetDemoData(): void
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
  // Ask CoNote AI.
  ai: AiService
  // The student's profile.
  profile: ProfileService
  // Demo-only actions; absent outside mock mode.
  demo?: DemoService
}
