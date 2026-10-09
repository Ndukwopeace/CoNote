/**
 * The platform's records as the services see them (admin REQUIREMENTS section 6). The demo seed
 * builds a full set; contract tests build small sets to prove each rule. The Supabase services
 * will read the same facts from the database tables named on each type. Times are ISO text.
 */

// The shared vocabulary.
import type { AccountStatus, AiJobStatus, CourseStatus, Role, SummaryStatus } from '@conote/domain'

/** An account (`profiles`). */
export interface UserRecord {
  id: string
  role: Role
  status: AccountStatus
  fullName: string
  email: string
  // The human-readable IDs (`profiles.student_number`, `profiles.staff_number`), separate from `id`.
  studentNumber: string | null
  staffNumber: string | null
  // Students' and teachers' department; null for administrators.
  department: string | null
  // A student's year of study, e.g. "300 Level"; null for other roles.
  level: string | null
  phone: string | null
  // When the account was created (invited).
  createdAt: string
  // The latest activity, or null if the account has never been used.
  lastActiveAt: string | null
}

/** A student in a course (`enrollments`). */
export interface EnrollmentRecord {
  courseId: string
  studentId: string
}

/**
 * One recorded platform action (`audit_logs`). Append-only: written by the backend, never by the
 * browser. A user's status history is read from these entries.
 */
export interface AuditEntry {
  id: string
  at: string
  // Who did it; null for the system.
  actorId: string | null
  // What happened, e.g. "user.status_changed".
  action: string
  // What it happened to.
  entityType: string
  entityId: string
  // Details, e.g. { from: "active", to: "suspended" }. Never note content.
  metadata: Record<string, string | null>
}

/** A course (`courses`). */
export interface CourseRecord {
  id: string
  // Unique, e.g. "SWE 311": letters, a space, three digits.
  code: string
  title: string
  description: string
  department: string | null
  // Where it is in its term.
  status: CourseStatus
  // The one teacher, or null while none is assigned.
  teacherId: string | null
  createdAt: string
  // When it was archived, or null while it is in use.
  archivedAt: string | null
}

/** The kinds of resource (`resources.type`). */
export type ResourceType = 'pdf' | 'document' | 'slides' | 'video' | 'link'

/** Where a resource is (`resources.status`). */
export type ResourceStatus = 'draft' | 'published' | 'archived'

/** A file or link attached to a course or class (`resources`, admin REQUIREMENTS section 6.2). */
export interface ResourceRecord {
  id: string
  title: string
  type: ResourceType
  courseId: string
  // The class it belongs to, or null for the whole course.
  classId: string | null
  status: ResourceStatus
  createdAt: string
}

/** A class (`class_sessions`). */
export interface ClassRecord {
  id: string
  courseId: string
  title: string
  startsAt: string
  archivedAt: string | null
}

/** A class's summary (`summaries`, with the class's summary status). */
export interface SummaryRecord {
  id: string
  classId: string
  status: SummaryStatus
  // When it entered review, or null if it hasn't yet.
  inReviewSince: string | null
  // When a teacher published it, or null if not published.
  publishedAt: string | null
}

/** An AI summary job (`ai_jobs`). */
export interface AiJobRecord {
  id: string
  classId: string
  status: AiJobStatus
  // Set once the job finishes, whether it succeeded or failed.
  finishedAt: string | null
}

/** What `activity_events` records (admin REQUIREMENTS section 6.2). No note content is stored. */
export type ActivityEventKind =
  'sign_in' | 'note_created' | 'summary_viewed' | 'resource_opened' | 'ai_question'

/** One measured action (`activity_events`). */
export interface ActivityEvent {
  kind: ActivityEventKind
  at: string
}

/** A notification that could not be delivered (from the notification sender's log). */
export interface DeliveryFailure {
  id: string
  at: string
}

/** A failed storage operation, such as an upload (from the storage log). */
export interface StorageError {
  id: string
  at: string
}

/** A security-related audit entry, such as repeated failed sign-ins (`audit_logs`). */
export interface SecurityEvent {
  id: string
  action: string
  at: string
}

/** The settings the dashboard reads (`platform_settings`). */
export interface PlatformSettings {
  // The current term, as YYYY-MM-DD local dates, both inclusive.
  termStartsOn: string
  termEndsOn: string
  // How many days a summary may wait in review before it raises an alert.
  reviewAlertDays: number
}

/** Everything the dashboard services read. */
export interface PlatformData {
  users: UserRecord[]
  enrollments: EnrollmentRecord[]
  auditLog: AuditEntry[]
  courses: CourseRecord[]
  resources: ResourceRecord[]
  classes: ClassRecord[]
  summaries: SummaryRecord[]
  aiJobs: AiJobRecord[]
  activity: ActivityEvent[]
  deliveryFailures: DeliveryFailure[]
  storageErrors: StorageError[]
  securityEvents: SecurityEvent[]
  settings: PlatformSettings
}

/** An empty platform with default settings, for tests to fill with only what they need. */
export function emptyPlatformData(overrides: Partial<PlatformData> = {}): PlatformData {
  return {
    users: [],
    enrollments: [],
    auditLog: [],
    courses: [],
    resources: [],
    classes: [],
    summaries: [],
    aiJobs: [],
    activity: [],
    deliveryFailures: [],
    storageErrors: [],
    securityEvents: [],
    settings: { termStartsOn: '2026-09-01', termEndsOn: '2026-12-18', reviewAlertDays: 3 },
    ...overrides,
  }
}

/** A user with sensible defaults, for tests to override only what they check. */
export function userRecord(
  overrides: Partial<UserRecord> & Pick<UserRecord, 'id' | 'role'>,
): UserRecord {
  return {
    status: 'active',
    fullName: overrides.id,
    email: `${overrides.id}@conote.example`,
    studentNumber: null,
    staffNumber: null,
    department: null,
    level: null,
    phone: null,
    createdAt: '2026-09-01T09:00:00.000Z',
    lastActiveAt: null,
    ...overrides,
  }
}

/** A course with sensible defaults, for tests to override only what they check. */
export function courseRecord(
  overrides: Partial<CourseRecord> & Pick<CourseRecord, 'id'>,
): CourseRecord {
  return {
    code: overrides.id.toUpperCase(),
    title: overrides.id,
    description: '',
    department: null,
    status: 'ongoing',
    teacherId: null,
    createdAt: '2026-08-15T09:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}
