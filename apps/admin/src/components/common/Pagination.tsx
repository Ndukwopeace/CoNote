/**
 * "Showing 21–25 of 25" and the previous and next buttons under a paged list.
 */

// Arrow icons.
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Buttons.
import { Button } from '@conote/ui/button'

/** Where the list is, and how to move. */
interface PaginationProps {
  // The current page, from 1.
  page: number
  pageSize: number
  // How many items match, across all pages.
  total: number
  // Goes to another page.
  onPageChange: (page: number) => void
}

/** The count and the two buttons. Renders nothing when there is nothing to count. */
export function Pagination({ page, pageSize, total, onPageChange }: Readonly<PaginationProps>) {
  // Nothing listed: nothing to say.
  if (total === 0) return null
  // The first and last item shown, and whether there are pages either side.
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  const hasNext = last < total

  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
      {/* Where we are; the dash is an en dash, as in a range. */}
      <p className="text-muted-foreground">
        Showing {first}–{last} of {total}
      </p>
      {/* Previous and next; disabled at the ends. */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1)
          }}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Next page"
          disabled={!hasNext}
          onClick={() => {
            onPageChange(page + 1)
          }}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
