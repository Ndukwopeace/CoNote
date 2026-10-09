/**
 * The platform records the teacher portal's services read. Field names and meanings are the
 * admin app's (admin REQUIREMENTS section 6), cut down to what a teacher needs, so the demo and
 * the Supabase services describe one platform. Times are ISO text.
 */

// The shared vocabulary.
import type { AccountStatus, CourseStatus, Role, SummaryStatus } from '@conote/domain'

/** An account (`profiles`): who can sign in, and as what. */
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
  // Unique, e.g. "MTH 202".
  code: string
  title: string
  // Where it is in its term.
  status: CourseStatus
  // The one teacher, or null while none is assigned.
  teacherId: string | null
  // When it was archived, or null while it is in use.
  archivedAt: string | null
}

/** A class (`class_sessions`). */
export interface ClassRecord {
  id: string
  courseId: string
  // Assigned within the course, from 1.
  number: number
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
}

/** Everything the teacher services read. */
export interface PlatformData {
  users: UserRecord[]
  courses: CourseRecord[]
  classes: ClassRecord[]
  summaries: SummaryRecord[]
}

/** An empty platform, for tests to fill with only what they need. */
export function emptyPlatformData(overrides: Partial<PlatformData> = {}): PlatformData {
  return { users: [], courses: [], classes: [], summaries: [], ...overrides }
}

/** A user with sensible defaults, for tests to override only what they check. */
export function userRecord(
  overrides: Partial<UserRecord> & Pick<UserRecord, 'id' | 'role'>,
): UserRecord {
  return {
    status: 'active',
    fullName: overrides.id,
    email: `${overrides.id}@conote.example`,
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
    status: 'ongoing',
    teacherId: null,
    archivedAt: null,
    ...overrides,
  }
}

/** A class with sensible defaults, for tests to override only what they check. */
export function classRecord(
  overrides: Partial<ClassRecord> & Pick<ClassRecord, 'id' | 'courseId'>,
): ClassRecord {
  return {
    number: 1,
    title: overrides.id,
    startsAt: '2026-09-10T09:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}

/** A summary with sensible defaults, for tests to override only what they check. */
export function summaryRecord(
  overrides: Partial<SummaryRecord> & Pick<SummaryRecord, 'id' | 'classId'>,
): SummaryRecord {
  return { status: 'collecting', inReviewSince: null, ...overrides }
}
