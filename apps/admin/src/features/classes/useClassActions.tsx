/**
 * What an administrator can do to one class (admin REQUIREMENTS section 13): edit it and archive
 * it (asking first). Shared by the list's row menu and the details page's buttons, so both behave
 * the same.
 */

// Dialog and confirmation state.
import { useState } from 'react'

// The confirmation dialog.
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
// Toasts.
import { useToast } from '@conote/ui/toast'

// The change.
import { useArchiveClass } from '@/hooks/useClasses'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'

// The edit form.
import { ClassFormDialog } from './ClassFormDialog'

/** The part of a class the actions need. */
interface ActionClass {
  id: string
  title: string
  // When it was archived, or null while it is in use.
  archivedAt: string | null
}

/** The actions for `item`, and the dialogs they open (render `dialogs` once). */
export function useClassActions(item: ActionClass) {
  // The change and the toast that reports it.
  const archive = useArchiveClass()
  const toast = useToast()
  // Whether the archive question or the edit form is open.
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [editing, setEditing] = useState(false)

  return {
    // An archived class can't be edited or archived again.
    isArchived: item.archivedAt !== null,
    // Opens the edit form.
    edit: () => {
      setEditing(true)
    },
    // Asks before archiving.
    askArchive: () => {
      setConfirmingArchive(true)
    },
    // The question and the edit form, mounted only while open, so a list of rows doesn't load
    // every class's details or build a dialog per row.
    dialogs: (
      <>
        {confirmingArchive && (
          <ConfirmDialog
            open
            onOpenChange={setConfirmingArchive}
            title={`Archive “${item.title}”?`}
            description="It is hidden from students and teachers and can’t be changed. Its notes and summary are kept."
            confirmLabel="Archive"
            onConfirm={() => {
              archive.mutate(item.id, {
                onSuccess: () => {
                  toast.success(`“${item.title}” archived.`)
                },
                onError: (error) => {
                  toast.error(errorMessage(error))
                },
              })
            }}
          />
        )}
        {editing && <ClassFormDialog classId={item.id} open onOpenChange={setEditing} />}
      </>
    ),
  }
}
