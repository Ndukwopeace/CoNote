/**
 * The search field and filters above the Users list (admin REQUIREMENTS section 11). They change
 * the address, which the list reads, so a filtered view can be shared and survives a refresh.
 */

// The search icon.
import { Search } from 'lucide-react'
// The search text while typing, and the pause before searching.
import { useEffect, useState } from 'react'

// Buttons, inputs and drop-downs.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
import { NativeSelect } from '@conote/ui/native-select'

// The filter choices.
import { useUserFilterOptions } from '@/hooks/useUsers'
// Whether anything is filtered.
import { hasUserFilters } from '@/lib/userFilters'
// Status wording.
import { statusLabel } from '@/lib/userStatus'
// The filter shape.
import type { UserFilter, UserFilterChange } from '@/types/users'

/** How long typing must pause before the search runs, so each key doesn't start one. */
const SEARCH_DELAY_MS = 300

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
  // The search box's text, which runs the search after a pause.
  const [text, setText] = useState(filter.q ?? '')
  // The address's search when the box last followed it.
  const [followedQ, setFollowedQ] = useState(filter.q)
  // Follow the address when it changes elsewhere (Clear filters, Back), while rendering.
  if (filter.q !== followedQ) {
    setFollowedQ(filter.q)
    setText(filter.q ?? '')
  }
  // Students and teachers have departments and courses; administrators don't.
  const showMembership = filter.role !== 'admin'

  // Search once typing pauses, unless the text already matches the address.
  useEffect(() => {
    // Nothing new to search for.
    if (text.trim() === (filter.q ?? '')) return
    // Wait for the pause, then search.
    const timer = setTimeout(() => {
      onChange({ q: text.trim() || undefined }, true)
    }, SEARCH_DELAY_MS)
    // A new key press restarts the wait.
    return () => {
      clearTimeout(timer)
    }
  }, [text, filter.q, onChange])

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search: name, email, student number or staff number. */}
      <div className="relative min-w-56 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search users"
          placeholder="Search by name, email or number"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
          className="pl-9"
        />
      </div>
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
