/**
 * The admin app's service interfaces: everything the UI may ask of the backend. Pages reach them
 * only through useServices(), so the demo data and Supabase are interchangeable (D66).
 */

// The shared vocabulary.
import type { AccountStatus } from '@conote/domain'

// Session shapes.
import type { PasswordResetRequest, Session, SignInInput } from '@/types/auth'
// Class shapes.
import type {
  ClassDetails,
  ClassFilter,
  ClassFilterOptions,
  ClassInput,
  ClassPage,
} from '@/types/classes'
// Course shapes.
import type {
  CourseDetails,
  CourseFilter,
  CourseFilterOptions,
  CourseInput,
  CoursePage,
  EnrolledStudent,
  EnrollmentMatch,
} from '@/types/courses'
// Dashboard shapes.
import type {
  ActivityPoint,
  ActivityRange,
  ActivitySeriesKey,
  HealthReport,
  PlatformAlert,
  PlatformOverview,
} from '@/types/dashboard'
// User shapes.
import type {
  InviteUserInput,
  UpdateUserInput,
  UserDetails,
  UserFilter,
  UserFilterOptions,
  UserPage,
} from '@/types/users'

/** Signing in and out, and the current session. */
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

/** Platform figures. A9 adds the Analytics page's statistics. */
export interface AnalyticsService {
  /** The six counts on the dashboard's stat cards. */
  getOverview(): Promise<PlatformOverview>
  /** One count per day for the last `range` days, oldest first, ending today. */
  getActivitySeries(range: ActivityRange, series: ActivitySeriesKey): Promise<ActivityPoint[]>
}

/** Problems worth an administrator's attention, computed from the platform's records. */
export interface AlertService {
  /** One entry per kind of problem that currently has a non-zero count, most urgent first. */
  listAlerts(): Promise<PlatformAlert[]>
}

/** The platform's health check (the `health` Edge Function in the backend stage). */
export interface HealthService {
  /** The latest state of each part of the platform. */
  getHealth(): Promise<HealthReport>
}

/**
 * The accounts on the platform (admin REQUIREMENTS section 11). Every change writes an audit
 * entry. In the backend stage, invite and status changes run in Edge Functions.
 */
export interface UserService {
  /** One page of one role's accounts, searched, filtered and sorted. */
  listUsers(filter: UserFilter): Promise<UserPage>
  /** The departments and courses the filters offer. */
  listFilterOptions(): Promise<UserFilterOptions>
  /** One account's details; rejects with not_found for an unknown ID. */
  getUser(userId: string): Promise<UserDetails>
  /** Creates an invited (pending) account; rejects with conflict when the email is taken. */
  inviteUser(input: InviteUserInput): Promise<UserDetails>
  /** Changes profile fields. */
  updateUser(userId: string, input: UpdateUserInput): Promise<UserDetails>
  /**
   * Activates, deactivates or suspends an account. Rejects a change the rules don't allow, and
   * any change to the administrator's own account.
   */
  setUserStatus(userId: string, status: AccountStatus): Promise<UserDetails>
  /** Sends a password reset link to an active account. */
  sendPasswordReset(userId: string): Promise<void>
}

/**
 * The courses and who is in them (admin REQUIREMENTS section 12). Every change writes an audit
 * entry. An archived course refuses changes until it is restored.
 */
export interface CourseService {
  /** One page of courses, searched, filtered and sorted. Archived ones only when asked for. */
  listCourses(filter: CourseFilter): Promise<CoursePage>
  /** The departments and active teachers the filters and the form offer. */
  listCourseFilterOptions(): Promise<CourseFilterOptions>
  /** One course's details; rejects with not_found for an unknown ID. */
  getCourse(courseId: string): Promise<CourseDetails>
  /** Creates a course; rejects with conflict when the code is taken, in any letter case. */
  createCourse(input: CourseInput): Promise<CourseDetails>
  /** Changes a course's details, including its teacher. */
  updateCourse(courseId: string, input: CourseInput): Promise<CourseDetails>
  /** Takes a course out of use; its classes, notes and enrolments are kept. */
  archiveCourse(courseId: string): Promise<CourseDetails>
  /** Puts an archived course back in use. */
  restoreCourse(courseId: string): Promise<CourseDetails>
  /** Gives the course a teacher (or changes it); the teacher must be active. */
  assignTeacher(courseId: string, teacherId: string): Promise<CourseDetails>
  /** Leaves the course without a teacher. */
  removeTeacher(courseId: string): Promise<CourseDetails>
  /** The course's students, A to Z, narrowed by a search of name, email and student number. */
  listEnrollments(courseId: string, q?: string): Promise<EnrolledStudent[]>
  /** Previews a bulk enrolment: sorts emails and student numbers into matched, enrolled and unmatched. */
  matchStudents(courseId: string, identifiers: string[]): Promise<EnrollmentMatch>
  /** Enrols the given students, skipping any who aren't active students or are already in. */
  enrollStudents(courseId: string, studentIds: string[]): Promise<{ added: number }>
  /** Removes one student from the course. */
  removeStudent(courseId: string, studentId: string): Promise<void>
}

/**
 * The class sessions of every course (admin REQUIREMENTS section 13). Every change writes an
 * audit entry. An archived class keeps its notes and summary but refuses changes.
 */
export interface ClassService {
  /** One page of classes, searched, filtered and sorted. Archived ones only when asked for. */
  listClasses(filter: ClassFilter): Promise<ClassPage>
  /** The courses the filter and the form offer. */
  listClassFilterOptions(): Promise<ClassFilterOptions>
  /** One class's details; rejects with not_found for an unknown ID. */
  getClass(classId: string): Promise<ClassDetails>
  /** Adds a class to a course in use, numbering it after the course's last one. */
  createClass(input: ClassInput): Promise<ClassDetails>
  /** Changes a class's title, time or description. A class can't move to another course. */
  updateClass(classId: string, input: ClassInput): Promise<ClassDetails>
  /** Hides a class from students and teachers; its notes and summary are kept. */
  archiveClass(classId: string): Promise<ClassDetails>
}

/** Every service the admin app uses. Grows with each milestone. */
export interface Services {
  auth: AuthService
  analytics: AnalyticsService
  alerts: AlertService
  health: HealthService
  users: UserService
  courses: CourseService
  classes: ClassService
}
