/**
 * Classes (admin REQUIREMENTS section 13): the list with search, filters, sorting, pages and the
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
import { ClassFormDialog } from '@/features/classes/ClassFormDialog'
import { ClassList } from '@/features/classes/ClassList'
// Reading and writing the filter in the address.
import { readClassFilter, writeClassFilter } from '@/lib/classFilters'
// The filter shape.
import type { ClassFilter } from '@/types/classes'

/** Classes. */
export function ClassesPage() {
  // The address's query, which holds the filter.
  const [params, setParams] = useSearchParams()
  const filter = readClassFilter(params)
  // Whether the create form is open.
  const [creating, setCreating] = useState(false)

  /** Applies `update` to the filter in the address; anything but a page change goes back to page 1. */
  const change = useCallback(
    (update: Partial<ClassFilter>, replace = false) => {
      setParams(
        (current) => writeClassFilter({ ...readClassFilter(current), page: 1, ...update }),
        { replace },
      )
    },
    [setParams],
  )

  /** Clears the search and filters, keeping the archived view and sort. */
  const clear = useCallback(() => {
    setParams((current) => {
      const { archived, sort } = readClassFilter(current)
      return writeClassFilter({ archived, sort, page: 1 })
    })
  }, [setParams])

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Classes" />
      {/* Heading and the create button. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Classes</h1>
        <Button
          type="button"
          onClick={() => {
            setCreating(true)
          }}
        >
          <Plus aria-hidden="true" />
          Create class
        </Button>
      </div>
      {/* The list. */}
      <ClassList
        filter={filter}
        onChange={change}
        onClear={clear}
        onCreate={() => {
          setCreating(true)
        }}
      />
      {/* The create form, starting with the list's course. */}
      <ClassFormDialog
        open={creating}
        onOpenChange={setCreating}
        defaultCourseId={filter.courseId ?? ''}
      />
    </div>
  )
}
