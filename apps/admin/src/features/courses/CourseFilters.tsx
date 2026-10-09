/**
 * The search field, filters and archived toggle above the Courses list (admin REQUIREMENTS
 * section 12). They change the address, which the list reads, so a filtered view can be shared
 * and survives a refresh.
 */

// A stable search handler.
import { useCallback } from 'react'

// Buttons and drop-downs.
import { Button } from '@conote/ui/button'
import { NativeSelect } from '@conote/ui/native-select'

// The search box.
import { SearchField } from '@/components/common/SearchField'
// The filter choices.
import { useCourseFilterOptions } from '@/hooks/useCourses'
// Whether anything is filtered.
import { hasCourseFilters } from '@/lib/courseFilters'
// Status wording.
import { COURSE_STATUSES, courseStatusLabel } from '@/lib/courseStatus'
// The filter shape.
import type { CourseFilter } from '@/types/courses'

/** The current filter, and how to change it. */
interface CourseFiltersProps {
  filter: CourseFilter
  // Applies a change; `replace` keeps typing out of the browser history.
  onChange: (change: Partial<CourseFilter>, replace?: boolean) => void
  // Clears the search and every filter.
  onClear: () => void
}

/** The search field, the filters, the archived toggle and "Clear filters", in one wrapping row. */
export function CourseFilters({ filter, onChange, onClear }: Readonly<CourseFiltersProps>) {
  // The departments and teachers to choose from.
  const options = useCourseFilterOptions()

  // Runs a search; `replace` keeps typing out of the browser history.
  const search = useCallback(
    (q: string | undefined) => {
      onChange({ q }, true)
    },
    [onChange],
  )

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search: code or title. */}
      <SearchField
        label="Search courses"
        placeholder="Search by code or title"
        value={filter.q}
        onSearch={search}
      />
      {/* Status. */}
      <label className="grid w-full gap-1 text-sm sm:w-auto">
        <span className="font-medium">Status</span>
        <NativeSelect
          value={filter.status ?? ''}
          onChange={(event) => {
            onChange({ status: COURSE_STATUSES.find((status) => status === event.target.value) })
          }}
          className="sm:w-40"
        >
          <option value="">All statuses</option>
          {COURSE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {courseStatusLabel(status)}
            </option>
          ))}
        </NativeSelect>
      </label>
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
      {/* Teacher: anyone active, or nobody (the dashboard's "course without a teacher" link). */}
      <label className="grid w-full gap-1 text-sm sm:w-auto">
        <span className="font-medium">Teacher</span>
        <NativeSelect
          value={filter.teacher ?? ''}
          onChange={(event) => {
            onChange({ teacher: event.target.value || undefined })
          }}
          className="sm:w-48"
        >
          <option value="">All teachers</option>
          <option value="none">No teacher</option>
          {options.data?.teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.fullName}
            </option>
          ))}
        </NativeSelect>
      </label>
      {/* Archived courses are hidden unless asked for. */}
      <label className="flex h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(filter.archived)}
          onChange={(event) => {
            onChange({ archived: event.target.checked || undefined })
          }}
          className="size-4 accent-primary"
        />
        Show archived courses
      </label>
      {/* Clear, when anything is set. */}
      {hasCourseFilters(filter) && (
        <Button type="button" variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
