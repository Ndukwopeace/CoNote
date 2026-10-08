/**
 * The platform's records as the services see them (admin REQUIREMENTS section 6). The demo seed
 * builds a full set; contract tests build small sets to prove each rule. The Supabase services
 * will read the same facts from the database tables named on each type. Times are ISO text.
 */

// The shared vocabulary.
import type { AccountStatus, AiJobStatus, Role, SummaryStatus } from '@conote/domain'

/** An account (`profiles`). */
export interface UserRecord {
  id: string
  role: Role
  status: AccountStatus
  fullName: string
  email: string
}

/** A course (`courses`). */
export interface CourseRecord {
  id: string
  code: string
  title: string
  // The one teacher, or null while none is assigned.
  teacherId: string | null
  // When it was archived, or null while it is in use.
  archivedAt: string | null
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
  courses: CourseRecord[]
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
    courses: [],
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
