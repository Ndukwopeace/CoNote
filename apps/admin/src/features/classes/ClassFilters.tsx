/**
 * The search field, filters and archived toggle above the Classes list (admin REQUIREMENTS
 * section 13). They change the address, which the list reads, so a filtered view can be shared
 * and survives a refresh.
 */

// A stable search handler.
import { useCallback } from 'react'

// Buttons, inputs and drop-downs.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
import { NativeSelect } from '@conote/ui/native-select'

// The search box.
import { SearchField } from '@/components/common/SearchField'
// The filter choices.
import { useClassFilterOptions } from '@/hooks/useClasses'
// Whether anything is filtered.
import { hasClassFilters } from '@/lib/classFilters'
// Stage wording.
import { summaryStatusLabel } from '@/lib/summaryStatus'
// The filter shape.
import type { ClassFilter, SummaryFilter } from '@/types/classes'

/** The summary filters, in the order the list offers them. */
const SUMMARY_OPTIONS: readonly SummaryFilter[] = [
  'none',
  'collecting',
  'processing',
  'in_review',
  'published',
]

/** The current filter, and how to change it. */
interface ClassFiltersProps {
  filter: ClassFilter
  // Applies a change; `replace` keeps typing out of the browser history.
  onChange: (change: Partial<ClassFilter>, replace?: boolean) => void
  // Clears the search and every filter.
  onClear: () => void
}

/** The search field, the filters, the archived toggle and "Clear filters", in one wrapping row. */
export function ClassFilters({ filter, onChange, onClear }: Readonly<ClassFiltersProps>) {
  // The courses to choose from.
  const options = useClassFilterOptions()

  // Runs a search; `replace` keeps typing out of the browser history.
  const search = useCallback(
    (q: string | undefined) => {
      onChange({ q }, true)
    },
    [onChange],
  )

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search: title or course code. */}
      <SearchField
        label="Search classes"
        placeholder="Search by title or course code"
        value={filter.q}
        onSearch={search}
      />
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
      {/* Summary stage, or none yet. */}
      <label className="grid w-full gap-1 text-sm sm:w-auto">
        <span className="font-medium">Summary</span>
        <NativeSelect
          value={filter.summaryStatus ?? ''}
          onChange={(event) => {
            onChange({ summaryStatus: SUMMARY_OPTIONS.find((o) => o === event.target.value) })
          }}
          className="sm:w-44"
        >
          <option value="">All summaries</option>
          {SUMMARY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {summaryStatusLabel(option === 'none' ? null : option)}
            </option>
          ))}
        </NativeSelect>
      </label>
      {/* The date range; both days are included. */}
      <div className="grid w-full gap-1 text-sm sm:w-auto">
        <label htmlFor="class-filter-from" className="font-medium">
          From
        </label>
        <Input
          id="class-filter-from"
          type="date"
          value={filter.from ?? ''}
          onChange={(event) => {
            onChange({ from: event.target.value || undefined })
          }}
          className="sm:w-40"
        />
      </div>
      <div className="grid w-full gap-1 text-sm sm:w-auto">
        <label htmlFor="class-filter-to" className="font-medium">
          To
        </label>
        <Input
          id="class-filter-to"
          type="date"
          value={filter.to ?? ''}
          onChange={(event) => {
            onChange({ to: event.target.value || undefined })
          }}
          className="sm:w-40"
        />
      </div>
      {/* Archived classes are hidden unless asked for. */}
      <label className="flex h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(filter.archived)}
          onChange={(event) => {
            onChange({ archived: event.target.checked || undefined })
          }}
          className="size-4 accent-primary"
        />
        Show archived classes
      </label>
      {/* Clear, when anything is set. */}
      {hasClassFilters(filter) && (
        <Button type="button" variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
