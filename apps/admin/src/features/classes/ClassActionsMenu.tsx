/**
 * The "…" menu on each row of the Classes list: view, edit and archive.
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
import type { ClassListItem } from '@/types/classes'

// The shared action logic.
import { useClassActions } from './useClassActions'

/** The menu for one class. */
export function ClassActionsMenu({ item }: Readonly<{ item: ClassListItem }>) {
  // What can be done, and the dialogs it opens.
  const actions = useClassActions(item)

  return (
    <>
      <DropdownMenu>
        {/* The button names the class, so screen readers know which row it is for. */}
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${item.title}`}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={routeTo.class(item.id)}>View</Link>
          </DropdownMenuItem>
          {/* An archived class can only be viewed. */}
          {!actions.isArchived && (
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
