/**
 * The Users list as a table (admin REQUIREMENTS section 11): each tab's columns on the shared
 * table, which sorts and shows a card per person on phones.
 */

// Children type.
import type { ReactNode } from 'react'
// Client-side links.
import { Link } from 'react-router'

// The shared vocabulary.
import type { Role } from '@conote/domain'

// The shared table.
import { DataTable, type DataColumn } from '@/components/common/DataTable'
// Dates.
import { formatDate } from '@/lib/format'
// Detail page addresses.
import { routeTo } from '@/lib/routes'
// Row and sort shapes.
import type { UserListItem, UserSort } from '@/types/users'

// The status label.
import { UserStatusBadge } from './UserStatusBadge'

/** A column of the Users table. */
type Column = DataColumn<UserListItem, UserSortField>

/** The fields the Users table sorts by. */
type UserSortField = 'name' | 'created' | 'lastActive'

/** The name, linking to the details page. */
const NAME: Column = {
  heading: 'Name',
  cell: (user) => (
    <Link to={routeTo.user(user.id)} className="font-medium hover:underline">
      {user.fullName}
    </Link>
  ),
  sortField: 'name',
}
const EMAIL: Column = { heading: 'Email', cell: (user) => user.email }
const COURSES: Column = { heading: 'Courses', cell: (user) => user.courseCount }
const STATUS: Column = {
  heading: 'Status',
  cell: (user) => <UserStatusBadge status={user.status} />,
}
const CREATED: Column = {
  heading: 'Created',
  cell: (user) => formatDate(user.createdAt),
  sortField: 'created',
  firstSort: 'descending',
}
const LAST_ACTIVE: Column = {
  heading: 'Last active',
  cell: (user) => formatDate(user.lastActiveAt, 'Never'),
  sortField: 'lastActive',
  firstSort: 'descending',
}

/** Each tab's columns, from the spec's table (section 11). Actions are added last. */
const COLUMNS: Record<Role, Column[]> = {
  student: [
    { heading: 'Student number', cell: (user) => user.studentNumber ?? '—' },
    NAME,
    EMAIL,
    COURSES,
    STATUS,
    CREATED,
    LAST_ACTIVE,
  ],
  teacher: [
    { heading: 'Staff number', cell: (user) => user.staffNumber ?? '—' },
    NAME,
    EMAIL,
    { heading: 'Department', cell: (user) => user.department ?? '—' },
    COURSES,
    STATUS,
  ],
  admin: [NAME, EMAIL, STATUS, CREATED],
}

/** What the table shows. */
interface UserTableProps {
  // The tab, which picks the columns.
  role: Role
  // Names the table for screen readers, e.g. "Users: Students".
  label: string
  users: UserListItem[]
  // The current sort.
  sort: UserSort
  onSortChange: (sort: UserSort) => void
  // The actions menu for one person.
  actions: (user: UserListItem) => ReactNode
}

/** The Users table: the shared table with this tab's columns. */
export function UserTable({
  role,
  label,
  users,
  sort,
  onSortChange,
  actions,
}: Readonly<UserTableProps>) {
  return (
    <DataTable
      label={label}
      rows={users}
      rowKey={(user) => user.id}
      columns={COLUMNS[role]}
      sort={sort}
      onSortChange={onSortChange}
      actions={actions}
    />
  )
}
