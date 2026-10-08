/**
 * What the Courses screens show (admin REQUIREMENTS section 12). Services return these shapes;
 * pages only display them.
 */

// The shared vocabulary.
import type { AccountStatus, CourseStatus, SummaryStatus } from '@conote/domain'

// Resource kinds and states.
import type { ResourceStatus, ResourceType } from '@/services/platformData'

/** How the list can be sorted: a field, descending when it starts with "-". */
export type CourseSort = 'code' | '-code' | 'title' | '-title' | 'students' | '-students'

/** What the list shows: courses in use or archived ones, narrowed by search and filters. */
export interface CourseFilter {
  // Matches code and title, ignoring case.
  q?: string | undefined
  status?: CourseStatus | undefined
  department?: string | undefined
  // A teacher's ID, or "none" for courses without one.
  teacher?: string | undefined
  // True for archived courses; otherwise courses in use.
  archived?: boolean | undefined
  sort?: CourseSort | undefined
  // From 1.
  page?: number | undefined
}

/** A person as the course screens name them. */
export interface PersonRef {
  id: string
  fullName: string
}

/** One row of the list. */
export interface CourseListItem {
  id: string
  code: string
  title: string
  department: string | null
  status: CourseStatus
  teacher: PersonRef | null
  studentCount: number
  classCount: number
  archivedAt: string | null
}

/** One page of the list. */
export interface CoursePage {
  items: CourseListItem[]
  total: number
  page: number
  pageSize: number
}

/** A class as the course's Classes tab shows it. */
export interface CourseClass {
  id: string
  title: string
  startsAt: string
  // The summary's stage, or null before the class has one.
  summaryStatus: SummaryStatus | null
  archived: boolean
}

/** A resource as the course's Resources tab shows it. */
export interface CourseResource {
  id: string
  title: string
  type: ResourceType
  status: ResourceStatus
  // The class it belongs to, or null for the whole course.
  classTitle: string | null
}

/** Everything on the course details page. */
export interface CourseDetails extends CourseListItem {
  description: string
  createdAt: string
  publishedSummaryCount: number
  // Oldest first.
  classes: CourseClass[]
  resources: CourseResource[]
}

/** What creating or editing a course needs. */
export interface CourseInput {
  code: string
  title: string
  description: string
  department: string | null
  status: CourseStatus
  // An active teacher's ID, or null for none yet.
  teacherId: string | null
}

/** A teacher the picker offers. */
export interface TeacherOption extends PersonRef {
  department: string | null
}

/** The choices the filters and forms offer. */
export interface CourseFilterOptions {
  departments: string[]
  // Active teachers only, A to Z.
  teachers: TeacherOption[]
}

/** A student in, or matched for, a course. */
export interface EnrolledStudent {
  id: string
  fullName: string
  email: string
  studentNumber: string | null
  status: AccountStatus
}

/** Why a bulk-enrolment row didn't match a student who can be enrolled. */
export type UnmatchedReason = 'not_found' | 'not_a_student' | 'not_active'

/** The preview of a bulk enrolment: who would be added, who already is, and what didn't match. */
export interface EnrollmentMatch {
  matched: EnrolledStudent[]
  alreadyEnrolled: EnrolledStudent[]
  unmatched: { value: string; reason: UnmatchedReason }[]
}
