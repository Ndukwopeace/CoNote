/**
 * The Classes table with its filters, pages, and loading, empty and error states (admin
 * REQUIREMENTS sections 13 and 22).
 */

// Icons for the empty states.
import { CalendarDays, SearchX } from 'lucide-react'

// Buttons, empty states and loading blocks.
import { Button } from '@conote/ui/button'
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Skeleton } from '@conote/ui/skeleton'

// The table.
import { ClassTable } from '@/components/classes/ClassTable'
// Load-failure panel and the page buttons.
import { ErrorState } from '@/components/common/ErrorState'
import { Pagination } from '@/components/common/Pagination'
// The list.
import { useClasses } from '@/hooks/useClasses'
// Whether anything is filtered.
import { hasClassFilters } from '@/lib/classFilters'
// The filter shape.
import type { ClassFilter, ClassListItem } from '@/types/classes'

// The row menu and the filters.
import { ClassActionsMenu } from './ClassActionsMenu'
import { ClassFilters } from './ClassFilters'

/** The filter, how to change it, and how to start creating a class. */
interface ClassListProps {
  filter: ClassFilter
  onChange: (change: Partial<ClassFilter>, replace?: boolean) => void
  onClear: () => void
  onCreate: () => void
}

/** The row menu for one class, defined once outside the component. */
function renderActions(item: ClassListItem) {
  return <ClassActionsMenu item={item} />
}

/** The list. */
export function ClassList({ filter, onChange, onClear, onCreate }: Readonly<ClassListProps>) {
  // The page of classes; the previous page stays while the next loads.
  const { data, isPending, isError, refetch } = useClasses(filter)

  /** The table, or the state in its place. */
  function body() {
    // Failed: the message and a retry.
    if (isError) return <ErrorState thing="classes" onRetry={() => void refetch()} />
    // First load: rows of blocks, announced once.
    if (isPending) {
      return (
        <output aria-label="Loading classes" className="block space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </output>
      )
    }
    // Nothing matches the search or filters: say so, and offer to clear them.
    if (data.total === 0 && hasClassFilters(filter)) {
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
      return <EmptyState icon={CalendarDays} title="No archived classes." />
    }
    // No class at all.
    if (data.total === 0) {
      return (
        <EmptyState
          icon={CalendarDays}
          title="No classes available."
          action={
            <Button type="button" onClick={onCreate}>
              Create the first class
            </Button>
          }
        />
      )
    }
    // The table and the pages.
    return (
      <div className="space-y-4">
        <ClassTable
          classes={data.items}
          sort={filter.sort ?? '-date'}
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
      <ClassFilters filter={filter} onChange={onChange} onClear={onClear} />
      {/* The table, or the state in its place. */}
      {body()}
    </div>
  )
}
