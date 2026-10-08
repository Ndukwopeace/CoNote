/**
 * The Users list as a table (admin REQUIREMENTS sections 11 and 21): each tab's columns, sortable
 * headings, and a card per person on phones. One set of markup serves both: below the tablet
 * width the rows restyle as cards, and each cell shows its column's name beside it.
 */

// Sort direction icons.
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
// Children type.
import type { ReactNode } from 'react'
// Client-side links.
import { Link } from 'react-router'

// The shared vocabulary.
import type { Role } from '@conote/domain'

// Dates.
import { formatDate } from '@/lib/format'
// Detail page addresses.
import { routeTo } from '@/lib/routes'
// Row and sort shapes.
import type { UserListItem, UserSort } from '@/types/users'

// The status label.
import { UserStatusBadge } from './UserStatusBadge'

/** A column: its heading, its cell, and the sort it offers, if any. */
interface Column {
  heading: string
  cell: (user: UserListItem) => ReactNode
  // The field it sorts by.
  sortField?: 'name' | 'created' | 'lastActive'
}

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
}
const LAST_ACTIVE: Column = {
  heading: 'Last active',
  cell: (user) => formatDate(user.lastActiveAt, 'Never'),
  sortField: 'lastActive',
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

/** The next sort when a column's heading is pressed: the other direction, or A to Z / newest. */
function nextSort(current: UserSort, field: NonNullable<Column['sortField']>): UserSort {
  // The same column: flip it.
  if (current === field) return `-${field}`
  if (current === `-${field}`) return field
  // A new column: names A to Z, dates newest first.
  return field === 'name' ? 'name' : `-${field}`
}

/** Whether `field` is the sort, which way, and the icon that says so. */
function sortState(sort: UserSort, field: Column['sortField']) {
  // Not this column (or not sortable): the neutral icon.
  if (field === undefined || (sort !== field && sort !== `-${field}`)) {
    return { ariaSort: undefined, Icon: ArrowUpDown }
  }
  // This column, descending.
  if (sort.startsWith('-')) return { ariaSort: 'descending' as const, Icon: ArrowDown }
  // This column, ascending.
  return { ariaSort: 'ascending' as const, Icon: ArrowUp }
}

/** The table. */
export function UserTable({
  role,
  label,
  users,
  sort,
  onSortChange,
  actions,
}: Readonly<UserTableProps>) {
  // This tab's columns.
  const columns = COLUMNS[role]

  return (
    // Explicit table and row roles keep the table's meaning for screen readers when phones
    // restyle it; each cell also carries its column's name as visible text there.
    <table role="table" aria-label={label} className="block w-full text-sm md:table">
      {/* Headings: hidden on phones (each cell names itself), a row on larger screens. */}
      <thead className="sr-only md:not-sr-only md:table-header-group">
        <tr role="row" className="border-b text-left text-muted-foreground">
          {columns.map((column) => {
            // This column's sort state.
            const field = column.sortField
            const { ariaSort, Icon } = sortState(sort, field)
            return (
              <th
                key={column.heading}
                role="columnheader"
                scope="col"
                aria-sort={ariaSort}
                className="px-3 py-2 font-medium"
              >
                {field ? (
                  // A sortable heading is a button.
                  <button
                    type="button"
                    onClick={() => {
                      onSortChange(nextSort(sort, field))
                    }}
                    className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {column.heading}
                    <Icon aria-hidden="true" className="size-3.5" />
                  </button>
                ) : (
                  column.heading
                )}
              </th>
            )
          })}
          <th role="columnheader" scope="col" className="px-3 py-2 text-right font-medium">
            Actions
          </th>
        </tr>
      </thead>
      {/* One row per person: a card on phones, a table row on larger screens. */}
      <tbody className="block space-y-3 md:table-row-group md:space-y-0">
        {users.map((user) => (
          <tr
            key={user.id}
            role="row"
            className="block rounded-xl border bg-card p-4 md:table-row md:rounded-none md:border-0 md:border-b md:bg-transparent md:p-0"
          >
            {columns.map((column) => (
              <td
                key={column.heading}
                // The column's name, shown beside the value on phones.
                data-label={column.heading}
                className="flex items-center justify-between gap-3 py-1 before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:px-3 md:py-2.5 md:before:content-none"
              >
                {column.cell(user)}
              </td>
            ))}
            <td className="flex justify-end pt-2 md:table-cell md:px-3 md:py-2.5 md:text-right">
              {actions(user)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
