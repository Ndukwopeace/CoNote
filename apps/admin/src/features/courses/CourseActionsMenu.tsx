/**
 * The "…" menu on each row of the Courses list: view, edit, and archive or restore.
 */

// The menu icon.
import { MoreHorizontal } from 'lucide-react'
// Client-side links.
import { Link } from 'react-router'

// Buttons and the menu.
import { Button } from '@conote/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conote/ui/dropdown-menu'

// Detail page addresses.
import { routeTo } from '@/lib/routes'
// Row shape.
import type { CourseListItem } from '@/types/courses'

// The shared action logic.
import { useCourseActions } from './useCourseActions'

/** The menu for one course. */
export function CourseActionsMenu({ course }: Readonly<{ course: CourseListItem }>) {
  // What can be done, and the dialogs it opens.
  const actions = useCourseActions(course)

  return (
    <>
      <DropdownMenu>
        {/* The button names the course, so screen readers know which row it is for. */}
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${course.code}`}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={routeTo.course(course.id)}>View</Link>
          </DropdownMenuItem>
          {actions.isArchived ? (
            // An archived course can only be restored.
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={actions.restore}>Restore</DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onSelect={actions.edit}>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={actions.askArchive}>Archive</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The confirmation and edit form this menu opens. */}
      {actions.dialogs}
    </>
  )
}
