/**
 * The Courses list as a table (admin REQUIREMENTS section 12): code, title, teacher, students,
 * classes and status on the shared table, which sorts and shows a card per course on phones.
 */

// Children type.
import type { ReactNode } from 'react'
// Client-side links.
import { Link } from 'react-router'

// The shared table.
import { DataTable, type DataColumn } from '@/components/common/DataTable'
// Detail page addresses.
import { routeTo } from '@/lib/routes'
// Row and sort shapes.
import type { CourseListItem, CourseSort } from '@/types/courses'

// The status label.
import { CourseStatusBadge } from './CourseStatusBadge'

/** The fields the table sorts by. */
type CourseSortField = 'code' | 'title' | 'students'

/** The table's columns. */
const COLUMNS: DataColumn<CourseListItem, CourseSortField>[] = [
  {
    heading: 'Code',
    cell: (course) => (
      <span className="flex flex-wrap items-center gap-2">
        <Link to={routeTo.course(course.id)} className="font-medium hover:underline">
          {course.code}
        </Link>
        {/* Students waiting to join, so the list shows where work is. */}
        {course.pendingRequestCount > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {course.pendingRequestCount} waiting
          </span>
        )}
      </span>
    ),
    sortField: 'code',
  },
  { heading: 'Title', cell: (course) => course.title, sortField: 'title' },
  {
    heading: 'Teacher',
    cell: (course) =>
      course.teacher ? (
        course.teacher.fullName
      ) : (
        <span className="text-muted-foreground">No teacher</span>
      ),
  },
  {
    heading: 'Students',
    cell: (course) => course.studentCount,
    sortField: 'students',
    firstSort: 'descending',
  },
  { heading: 'Classes', cell: (course) => course.classCount },
  {
    heading: 'Status',
    cell: (course) => <CourseStatusBadge status={course.status} archivedAt={course.archivedAt} />,
  },
]

/** What the table shows. */
interface CourseTableProps {
  courses: CourseListItem[]
  // The current sort.
  sort: CourseSort
  onSortChange: (sort: CourseSort) => void
  // The actions menu for one course.
  actions: (course: CourseListItem) => ReactNode
}

/** The Courses table: the shared table with this list's columns. */
export function CourseTable({ courses, sort, onSortChange, actions }: Readonly<CourseTableProps>) {
  return (
    <DataTable
      label="Courses"
      rows={courses}
      rowKey={(course) => course.id}
      columns={COLUMNS}
      sort={sort}
      onSortChange={onSortChange}
      actions={actions}
    />
  )
}
