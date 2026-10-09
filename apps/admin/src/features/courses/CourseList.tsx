/**
 * The Courses table with its filters, pages, and loading, empty and error states (admin
 * REQUIREMENTS sections 12 and 22).
 */

// Icons for the empty states.
import { BookOpen, SearchX } from 'lucide-react'

// Buttons, empty states and loading blocks.
import { Button } from '@conote/ui/button'
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel and the page buttons.
import { ErrorState } from '@conote/portal'
import { Pagination } from '@/components/common/Pagination'
// The table.
import { CourseTable } from '@/components/courses/CourseTable'
// The list.
import { useCourses } from '@/hooks/useCourses'
// Whether anything is filtered.
import { hasCourseFilters } from '@/lib/courseFilters'
// The filter shape.
import type { CourseFilter, CourseListItem } from '@/types/courses'

// The row menu and the filters.
import { CourseActionsMenu } from './CourseActionsMenu'
import { CourseFilters } from './CourseFilters'

/** The filter, how to change it, and how to start creating a course. */
interface CourseListProps {
  filter: CourseFilter
  onChange: (change: Partial<CourseFilter>, replace?: boolean) => void
  onClear: () => void
  onCreate: () => void
}

/** The row menu for one course, defined once outside the component. */
function renderActions(course: CourseListItem) {
  return <CourseActionsMenu course={course} />
}

/** The list. */
export function CourseList({ filter, onChange, onClear, onCreate }: Readonly<CourseListProps>) {
  // The page of courses; the previous page stays while the next loads.
  const { data, isPending, isError, refetch } = useCourses(filter)

  /** The table, or the state in its place. */
  function body() {
    // Failed: the message and a retry.
    if (isError) return <ErrorState thing="courses" onRetry={() => void refetch()} />
    // First load: rows of blocks, announced once.
    if (isPending) {
      return (
        <output aria-label="Loading courses" className="block space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </output>
      )
    }
    // Nothing matches the search or filters: say so, and offer to clear them.
    if (data.total === 0 && hasCourseFilters(filter)) {
      return (
        <EmptyState
          icon={SearchX}
          title="Nothing matches these filters."
          action={
            <Button type="button" variant="outline" onClick={onClear}>
              Clear filters
            </Button>
          }
        />
      )
    }
    // The archived view with nothing in it.
    if (data.total === 0 && filter.archived) {
      return <EmptyState icon={BookOpen} title="No archived courses." />
    }
    // No course at all.
    if (data.total === 0) {
      return (
        <EmptyState
          icon={BookOpen}
          title="No courses have been created yet."
          action={
            <Button type="button" onClick={onCreate}>
              Create the first course
            </Button>
          }
        />
      )
    }
    // The table and the pages.
    return (
      <div className="space-y-4">
        <CourseTable
          courses={data.items}
          sort={filter.sort ?? 'code'}
          onSortChange={(sort) => {
            onChange({ sort })
          }}
          actions={renderActions}
        />
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={(page) => {
            onChange({ page })
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Search and filters. */}
      <CourseFilters filter={filter} onChange={onChange} onClear={onClear} />
      {/* The table, or the state in its place. */}
      {body()}
    </div>
  )
}
