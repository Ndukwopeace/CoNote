/**
 * The "…" menu on each row of the Users list: view, edit, status changes, the reset link (or an
 * invitation sent again), deleting an invitation and deleting an account.
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
import type { UserListItem } from '@/types/users'

// The shared action logic.
import { useUserActions } from './useUserActions'

/** The menu for one person. */
export function UserActionsMenu({ user }: Readonly<{ user: UserListItem }>) {
  // What can be done, and the dialogs it opens.
  const actions = useUserActions(user)

  return (
    <>
      <DropdownMenu>
        {/* The button names the person, so screen readers know which row it is for. */}
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${user.fullName}`}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* View and edit. */}
          <DropdownMenuItem asChild>
            <Link to={routeTo.user(user.id)}>View</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.edit}>Edit</DropdownMenuItem>
          {/* Teachers can be given a course. */}
          {actions.canAssignCourse && (
            <DropdownMenuItem onSelect={actions.assignCourse}>Assign to course</DropdownMenuItem>
          )}
          {/* Status changes, when any are allowed. */}
          {actions.statusActions.length > 0 && <DropdownMenuSeparator />}
          {actions.statusActions.map((action) => (
            <DropdownMenuItem
              key={action.to}
              onSelect={() => {
                actions.changeStatus(action)
              }}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
          {/* The reset link for active accounts; for an invited person, the invitation again. */}
          {actions.canSendReset && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={actions.sendReset}>
                {actions.isInvited ? 'Resend invitation' : 'Send password reset link'}
              </DropdownMenuItem>
            </>
          )}
          {/* Anyone who has accepted can be deleted for good, after typing their name. */}
          {actions.canDeleteUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={actions.deleteUser}>Delete user</DropdownMenuItem>
            </>
          )}
          {/* An invitation nobody accepted can be deleted. */}
          {actions.canDeleteInvitation && (
            <DropdownMenuItem onSelect={actions.deleteInvitation}>
              Delete invitation
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The confirmation and edit form this menu opens. */}
      {actions.dialogs}
    </>
  )
}
