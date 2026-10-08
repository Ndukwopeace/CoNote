/**
 * What the Users screens show (admin REQUIREMENTS section 11). Services return these shapes;
 * pages only display them.
 */

// The shared vocabulary.
import type { AccountStatus, Role } from '@conote/domain'

/** How the list can be sorted: a field, descending when it starts with "-". */
export type UserSort = 'name' | '-name' | 'created' | '-created' | 'lastActive' | '-lastActive'

/** What the list shows: one role's accounts, narrowed by search and filters, one page at a time. */
export interface UserFilter {
  // The tab.
  role: Role
  // Matches name, email, student number and staff number, ignoring case.
  q?: string | undefined
  status?: AccountStatus | undefined
  department?: string | undefined
  // Students enrolled in it, or teachers teaching it.
  courseId?: string | undefined
  sort?: UserSort | undefined
  // From 1.
  page?: number | undefined
}

/** A change to the filter: a value sets that part, undefined clears it. */
export type UserFilterChange = Partial<UserFilter>

/** One row of the list. */
export interface UserListItem {
  id: string
  role: Role
  status: AccountStatus
  fullName: string
  email: string
  studentNumber: string | null
  staffNumber: string | null
  department: string | null
  // Courses enrolled in (students) or taught (teachers); 0 for administrators.
  courseCount: number
  createdAt: string
  lastActiveAt: string | null
}

/** One page of the list. */
export interface UserPage {
  items: UserListItem[]
  // How many accounts match, across all pages.
  total: number
  page: number
  pageSize: number
}

/** A course as the user screens name it. */
export interface CourseRef {
  id: string
  code: string
  title: string
}

/** One step in an account's status history. */
export interface StatusChange {
  // The status it moved to.
  status: AccountStatus
  at: string
  // Who made the change: a name, or null when the system or the user did it.
  byName: string | null
}

/** Everything on the user details page. Never note content. */
export interface UserDetails extends UserListItem {
  level: string | null
  phone: string | null
  // Enrolled in (students) or taught (teachers).
  courses: CourseRef[]
  // Oldest first.
  statusHistory: StatusChange[]
}

/** The choices the filters offer. */
export interface UserFilterOptions {
  departments: string[]
  courses: CourseRef[]
}

/** What inviting someone needs. */
export interface InviteUserInput {
  role: Role
  fullName: string
  email: string
  // Students' and teachers' department.
  department?: string | undefined
}

/** The profile fields an administrator can change. */
export interface UpdateUserInput {
  fullName: string
  department: string | null
  level: string | null
  phone: string | null
  studentNumber: string | null
  staffNumber: string | null
}
