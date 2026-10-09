/**
 * Courses (admin REQUIREMENTS section 12): the list with search, filters, sorting, pages and the
 * archived view kept in the address, and the create form.
 */

// The create icon.
import { Plus } from 'lucide-react'
// Dialog state and a stable change handler.
import { useCallback, useState } from 'react'
// The address's query.
import { useSearchParams } from 'react-router'

// Buttons and the tab title.
import { Button } from '@conote/ui/button'
import { PageTitle } from '@conote/ui/common/PageTitle'

// The create form and the list.
import { CourseFormDialog } from '@/features/courses/CourseFormDialog'
import { CourseList } from '@/features/courses/CourseList'
// Reading and writing the filter in the address.
import { readCourseFilter, writeCourseFilter } from '@/lib/courseFilters'
// The filter shape.
import type { CourseFilter } from '@/types/courses'

/** Courses. */
export function CoursesPage() {
  // The address's query, which holds the filter.
  const [params, setParams] = useSearchParams()
  const filter = readCourseFilter(params)
  // Whether the create form is open.
  const [creating, setCreating] = useState(false)

  /** Applies `update` to the filter in the address; anything but a page change goes back to page 1. */
  const change = useCallback(
    (update: Partial<CourseFilter>, replace = false) => {
      setParams(
        (current) => writeCourseFilter({ ...readCourseFilter(current), page: 1, ...update }),
        { replace },
      )
    },
    [setParams],
  )

  /** Clears the search and filters, keeping the archived view and sort. */
  const clear = useCallback(() => {
    setParams((current) => {
      const { archived, sort } = readCourseFilter(current)
      return writeCourseFilter({ archived, sort, page: 1 })
    })
  }, [setParams])

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Courses" />
      {/* Heading and the create button. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Courses</h1>
        <Button
          type="button"
          onClick={() => {
            setCreating(true)
          }}
        >
          <Plus aria-hidden="true" />
          Create course
        </Button>
      </div>
      {/* The list. */}
      <CourseList
        filter={filter}
        onChange={change}
        onClear={clear}
        onCreate={() => {
          setCreating(true)
        }}
      />
      {/* The create form. */}
      <CourseFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
