/**
 * One tab of the Users page: the filters, the table, the pages, and the loading, empty and error
 * states (admin REQUIREMENTS sections 11 and 22).
 */

// Icons for the empty states.
import { SearchX, Users } from 'lucide-react'

// Buttons, empty states and loading blocks.
import { Button } from '@conote/ui/button'
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel and the page buttons.
import { ErrorState } from '@/components/common/ErrorState'
import { Pagination } from '@/components/common/Pagination'
// The table.
import { UserTable } from '@/components/users/UserTable'
// Whether anything is filtered.
import { hasUserFilters } from '@/lib/userFilters'
// The list.
import { useUsers } from '@/hooks/useUsers'
// The filter shape.
import type { UserFilter, UserFilterChange } from '@/types/users'

// The filters, and the row menu.
import { UserActionsMenu } from './UserActionsMenu'
import { UserFilters } from './UserFilters'

/** The tab's filter, its name, and how to change the filter. */
interface UserListProps {
  filter: UserFilter
  // The tab's name, e.g. "Students".
  label: string
  onChange: (change: UserFilterChange, replace?: boolean) => void
  onClear: () => void
}

/** The list for one tab. */
export function UserList({ filter, label, onChange, onClear }: Readonly<UserListProps>) {
  // The page of accounts; the previous page stays while the next loads.
  const { data, isPending, isError, refetch } = useUsers(filter)

  /** The table, or the state in its place. */
  function body() {
    // Failed: the message and a retry.
    if (isError) return <ErrorState thing="users" onRetry={() => void refetch()} />
    // First load: rows of blocks, announced once.
    if (isPending) {
      return (
        <output aria-label="Loading users" className="block space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </output>
      )
    }
    // Nothing matches the search or filters: say so, and offer to clear them.
    if (data.total === 0 && hasUserFilters(filter)) {
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
    // Nobody in this tab at all.
    if (data.total === 0) return <EmptyState icon={Users} title="No users found." />
    // The table and the pages.
    return (
      <div className="space-y-4">
        <UserTable
          role={filter.role}
          label={`Users: ${label}`}
          users={data.items}
          sort={filter.sort ?? 'name'}
          onSortChange={(sort) => {
            onChange({ sort })
          }}
          actions={(user) => <UserActionsMenu user={user} />}
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
      <UserFilters filter={filter} onChange={onChange} onClear={onClear} />
      {/* The table, or the state in its place. */}
      {body()}
    </div>
  )
}
