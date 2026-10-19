/**
 * The admin app's service interfaces: everything the UI may ask of the backend. Pages reach them
 * only through useServices(), so the demo data and Supabase are interchangeable (D66).
 */

// The shared vocabulary.
import type { AccountStatus } from '@conote/domain'

// The sign-in service the staff portals share.
import type { AuthService } from '@conote/portal'
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
  EnrollmentRequest,
  RequestDecision,
} from '@/types/courses'
// The timetable import's payload.
import type { ImportPayload } from '@/lib/timetable/payload'
// Programme shapes.
import type {
  ImportOutcome,
  ProgrammeListItem,
  ProgrammeMember,
  ProgrammeRequestItem,
} from '@/types/programmes'
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
  /**
   * Sends a password link to an active account, or the invitation again to an invited one.
   * Rejects for a blocked account.
   */
  sendPasswordReset(userId: string): Promise<void>
  /**
   * Deletes an invitation nobody has accepted, along with the login. Rejects for any other
   * account (who keeps their notes and history) and for the administrator's own.
   */
  deleteInvitation(userId: string): Promise<void>
  /**
   * Deletes an account of any status for good: the login, and with it the person's notes,
   * enrolments and requests. Courses they taught are left without a teacher. Rejects for the
   * administrator's own account and with not_found for an unknown one.
   */
  deleteUser(userId: string): Promise<void>
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
  /**
   * Deletes an archived course for good, with its classes, summaries, students' notes,
   * resources, enrolments and requests. A course in use is refused: it must be archived first.
   */
  deleteCourse(courseId: string): Promise<void>
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
  /**
   * The course's students' requests to join that are waiting for a decision, oldest first
   * (D76). Rejects with not_found for an unknown course.
   */
  listEnrollmentRequests(courseId: string): Promise<EnrollmentRequest[]>
  /**
   * Approves or declines a waiting request. Approving enrols the student, as bulk enrolment
   * does; an archived course refuses both, an account that can't be enrolled refuses approval,
   * and a request already decided is a conflict. Rejects with not_found for an unknown request.
   */
  decideEnrollmentRequest(requestId: string, decision: RequestDecision): Promise<void>
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

/**
 * Programmes, and creating courses and classes from the school's timetable (D105). Every real
 * import writes an audit entry. Nothing that exists is overwritten.
 */
export interface ProgrammeService {
  /** Every programme with its counts, A to Z by code. */
  listProgrammes(): Promise<ProgrammeListItem[]>
  /**
   * Opens or closes a programme to students joining it themselves. Rejects with not_found for an
   * unknown ID.
   */
  setEnrolmentOpen(programmeId: string, open: boolean): Promise<ProgrammeListItem>
  /**
   * Creates the programmes, courses and classes a timetable describes, all or nothing. Courses are
   * matched by code, so an existing course keeps its title and teacher (a teacher is filled in
   * only where there is none), and a class that already starts at the same moment is skipped.
   * With `dryRun` nothing is saved and the answer says what would happen. Rejects with validation
   * for a payload that breaks the rules, an unknown time zone or a teacher who is not active.
   */
  importTimetable(payload: ImportPayload, options: { dryRun: boolean }): Promise<ImportOutcome>
  /** The requests waiting for a decision (D106), oldest first. */
  listProgrammeRequests(): Promise<ProgrammeRequestItem[]>
  /**
   * Approves or declines a waiting request. Approving enrols the student in every course in use
   * the programme holds and makes it their programme. Rejects with not_found for an unknown ID,
   * conflict once decided, and conflict when the student is already in a programme.
   */
  decideProgrammeRequest(requestId: string, decision: 'approved' | 'declined'): Promise<void>
  /** The students in a programme, A to Z by name. */
  listProgrammeMembers(programmeId: string): Promise<ProgrammeMember[]>
  /**
   * Takes a student out of their programme and out of the programme's courses; their notes are
   * kept, and they may ask to join a programme again. Returns how many courses they left. Rejects
   * with not_found for a student who is not in a programme.
   */
  removeFromProgramme(studentId: string): Promise<number>
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
  programmes: ProgrammeService
}
