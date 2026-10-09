/**
 * The Classes list as a table (admin REQUIREMENTS section 13): course, number, title, date and
 * time, teacher, summary status and notes on the shared table, which sorts and shows a card per
 * class on phones.
 */

// Children type.
import type { ReactNode } from 'react'
// Client-side links.
import { Link } from 'react-router'

// The shared table.
import { DataTable, type DataColumn } from '@/components/common/DataTable'
// Dates and times.
import { formatDate } from '@/lib/format'
import { formatTimeRange } from '@/lib/classTimes'
// Detail page addresses.
import { routeTo } from '@/lib/routes'
// Row and sort shapes.
import type { ClassListItem, ClassSort } from '@/types/classes'

// The summary label.
import { SummaryStatusBadge } from './SummaryStatusBadge'

/** The fields the table sorts by. */
type ClassSortField = 'date' | 'course' | 'title'

/** The table's columns. */
const COLUMNS: DataColumn<ClassListItem, ClassSortField>[] = [
  { heading: 'Course', cell: (item) => item.courseCode, sortField: 'course' },
  { heading: 'No.', cell: (item) => item.number },
  {
    heading: 'Title',
    cell: (item) => (
      <Link to={routeTo.class(item.id)} className="font-medium hover:underline">
        {item.title}
      </Link>
    ),
    sortField: 'title',
  },
  {
    heading: 'Date and time',
    cell: (item) => `${formatDate(item.startsAt)} ${formatTimeRange(item.startsAt, item.endsAt)}`,
    sortField: 'date',
    firstSort: 'descending',
  },
  {
    heading: 'Teacher',
    cell: (item) =>
      item.teacher ? (
        item.teacher.fullName
      ) : (
        <span className="text-muted-foreground">No teacher</span>
      ),
  },
  { heading: 'Summary', cell: (item) => <SummaryStatusBadge status={item.summaryStatus} /> },
  { heading: 'Notes', cell: (item) => item.noteCount },
]

/** What the table shows. */
interface ClassTableProps {
  classes: ClassListItem[]
  // The current sort.
  sort: ClassSort
  onSortChange: (sort: ClassSort) => void
  // The actions menu for one class.
  actions: (item: ClassListItem) => ReactNode
}

/** The Classes table: the shared table with this list's columns. */
export function ClassTable({ classes, sort, onSortChange, actions }: Readonly<ClassTableProps>) {
  return (
    <DataTable
      label="Classes"
      rows={classes}
      rowKey={(item) => item.id}
      columns={COLUMNS}
      sort={sort}
      onSortChange={onSortChange}
      actions={actions}
    />
  )
}
