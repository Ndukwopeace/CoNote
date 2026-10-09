/**
 * The search field and filters above the Users list (admin REQUIREMENTS section 11). They change
 * the address, which the list reads, so a filtered view can be shared and survives a refresh.
 */

// A stable search handler.
import { useCallback } from 'react'

// Buttons, inputs and drop-downs.
import { Button } from '@conote/ui/button'
import { NativeSelect } from '@conote/ui/native-select'

// The search box.
import { SearchField } from '@/components/common/SearchField'
// The filter choices.
import { useUserFilterOptions } from '@/hooks/useUsers'
// Whether anything is filtered.
import { hasUserFilters } from '@/lib/userFilters'
// Status wording.
import { statusLabel } from '@/lib/userStatus'
// The filter shape.
import type { UserFilter, UserFilterChange } from '@/types/users'

/** The statuses, in the order the filter lists them. */
const STATUSES = ['active', 'pending', 'inactive', 'suspended'] as const

/** The current filter, and how to change it. */
interface UserFiltersProps {
  filter: UserFilter
  // Applies a change; `replace` keeps typing out of the browser history.
  onChange: (change: UserFilterChange, replace?: boolean) => void
  // Clears the search and every filter.
  onClear: () => void
}

/** The search field, the filters and "Clear filters", in one row that wraps. */
export function UserFilters({ filter, onChange, onClear }: Readonly<UserFiltersProps>) {
  // The departments and courses to choose from.
  const options = useUserFilterOptions()
  // Students and teachers have departments and courses; administrators don't.
  const showMembership = filter.role !== 'admin'

  // Runs a search; `replace` keeps typing out of the browser history.
  const search = useCallback(
    (q: string | undefined) => {
      onChange({ q }, true)
    },
    [onChange],
  )

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search: name, email, student number or staff number. */}
      <SearchField
        label="Search users"
        placeholder="Search by name, email or number"
        value={filter.q}
        onSearch={search}
      />
      {/* Status. */}
      <label className="grid w-full gap-1 text-sm sm:w-auto">
        <span className="font-medium">Status</span>
        <NativeSelect
          value={filter.status ?? ''}
          onChange={(event) => {
            onChange({ status: STATUSES.find((status) => status === event.target.value) })
          }}
          className="sm:w-40"
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </NativeSelect>
      </label>
      {showMembership && (
        <>
          {/* Department. */}
          <label className="grid w-full gap-1 text-sm sm:w-auto">
            <span className="font-medium">Department</span>
            <NativeSelect
              value={filter.department ?? ''}
              onChange={(event) => {
                onChange({ department: event.target.value || undefined })
              }}
              className="sm:w-48"
            >
              <option value="">All departments</option>
              {options.data?.departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </NativeSelect>
          </label>
          {/* Course. */}
          <label className="grid w-full gap-1 text-sm sm:w-auto">
            <span className="font-medium">Course</span>
            <NativeSelect
              value={filter.courseId ?? ''}
              onChange={(event) => {
                onChange({ courseId: event.target.value || undefined })
              }}
              className="sm:w-48"
            >
              <option value="">All courses</option>
              {options.data?.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} {course.title}
                </option>
              ))}
            </NativeSelect>
          </label>
        </>
      )}
      {/* Clear, when anything is set. */}
      {hasUserFilters(filter) && (
        <Button type="button" variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
