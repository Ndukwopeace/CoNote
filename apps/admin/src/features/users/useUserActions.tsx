/**
 * What an administrator can do to one account (admin REQUIREMENTS section 11): change its status
 * (asking first before blocking it), send a reset link, and edit it. Shared by the list's row
 * menu and the details page's buttons, so both behave the same.
 */

// Dialog and confirmation state.
import { useState } from 'react'

// The confirmation dialog.
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
// Toasts.
import { useToast } from '@conote/ui/toast'

// The signed-in administrator.
import { useAuth } from '@/features/auth/useAuth'
// The changes.
import { useSendPasswordReset, useSetUserStatus } from '@/hooks/useUsers'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Status rules and wording.
import {
  canSendPasswordReset,
  statusActions,
  statusLabel,
  type StatusAction,
} from '@/lib/userStatus'
// Row shape.
import type { UserListItem } from '@/types/users'

// The edit form.
import { EditUserDialog } from './EditUserDialog'

/** What each blocking change says before it happens. */
function confirmText(action: StatusAction, user: UserListItem) {
  // Withdrawing an invitation.
  if (user.status === 'pending') {
    return 'This withdraws the invitation. They won’t be able to sign in unless you activate the account later.'
  }
  // Suspending.
  if (action.to === 'suspended') {
    return 'They’ll be signed out at once and can’t sign in until an administrator activates the account. Their notes and courses are kept.'
  }
  // Deactivating.
  return 'They’ll be signed out at once and can’t sign in until an administrator activates the account again. Their notes and courses are kept.'
}

/** The actions for `user`, and the dialogs they open (render `dialogs` once). */
export function useUserActions(user: UserListItem) {
  // The signed-in administrator, toasts and the two changes.
  const { session } = useAuth()
  const toast = useToast()
  const setStatus = useSetUserStatus()
  const sendReset = useSendPasswordReset()
  // The change waiting for confirmation, and whether the edit form is open.
  const [pending, setPending] = useState<StatusAction | null>(null)
  const [editing, setEditing] = useState(false)

  // SECURITY: no status changes on one's own account (the service refuses them too).
  const isSelf = session?.user.id === user.id

  /** Applies a status change and says how it went. */
  function apply(action: StatusAction) {
    setStatus.mutate(
      { userId: user.id, status: action.to },
      {
        onSuccess: () => {
          toast.success(`${user.fullName} is now ${statusLabel(action.to).toLowerCase()}.`)
        },
        onError: (error) => {
          toast.error(errorMessage(error))
        },
      },
    )
  }

  return {
    isSelf,
    // The status changes on offer; none on one's own account.
    statusActions: isSelf ? [] : statusActions(user.status),
    // Whether a reset link can be sent.
    canSendReset: canSendPasswordReset(user.status),
    // Starts a change: asks first when it blocks the account.
    changeStatus: (action: StatusAction) => {
      if (action.confirm) setPending(action)
      else apply(action)
    },
    // Sends a reset link and says so.
    sendReset: () => {
      sendReset.mutate(user.id, {
        onSuccess: () => {
          toast.success(`Password reset link sent to ${user.email}.`)
        },
        onError: (error) => {
          toast.error(errorMessage(error))
        },
      })
    },
    // Opens the edit form.
    edit: () => {
      setEditing(true)
    },
    // The confirmation and the edit form.
    dialogs: (
      <>
        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) setPending(null)
          }}
          title={pending ? `${pending.label} ${user.fullName}?` : ''}
          description={pending ? confirmText(pending, user) : ''}
          confirmLabel={pending?.label ?? ''}
          onConfirm={() => {
            if (pending) apply(pending)
          }}
        />
        <EditUserDialog userId={user.id} open={editing} onOpenChange={setEditing} />
      </>
    ),
  }
}
