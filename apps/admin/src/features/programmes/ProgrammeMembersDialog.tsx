/**
 * One programme's students, with a button to remove each (D106). Removing takes the student out of
 * the programme and its courses; their notes are kept, and they may ask to join a programme again.
 * The administrator confirms first. Loading, empty and error states are all handled.
 */

// Local state.
import { useState } from 'react'

// Buttons, confirmation, dialog parts, loading blocks and the toast.
import { Button } from '@conote/ui/button'
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@conote/ui/dialog'
import { Skeleton } from '@conote/ui/skeleton'
import { useToast } from '@conote/ui/toast'

// The load-failure panel.
import { ErrorState } from '@conote/portal'
// The data and the change.
import { useProgrammeMembers, useRemoveFromProgramme } from '@/hooks/useProgrammes'
// Words for a refused change.
import { programmeMessage } from './programmeMessage'
// Shapes.
import type { ProgrammeListItem, ProgrammeMember } from '@/types/programmes'

/** What the dialog needs. */
interface ProgrammeMembersDialogProps {
  // The programme whose students are shown; null keeps the dialog closed.
  programme: ProgrammeListItem | null
  onClose: () => void
}

/** The dialog. */
export function ProgrammeMembersDialog({
  programme,
  onClose,
}: Readonly<ProgrammeMembersDialogProps>) {
  // The students, the removal and the student being asked about.
  const members = useProgrammeMembers(programme?.id ?? null)
  const remove = useRemoveFromProgramme()
  const toast = useToast()
  const [removing, setRemoving] = useState<ProgrammeMember | null>(null)

  /** The list, or the state in its place. */
  function body() {
    if (members.isError) {
      return <ErrorState thing="students" onRetry={() => void members.refetch()} />
    }
    if (members.isPending) {
      return (
        <output aria-label="Loading students" className="block space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </output>
      )
    }
    if (members.data.length === 0) {
      return <p className="text-sm text-muted-foreground">No students have joined yet.</p>
    }
    return (
      <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {members.data.map((member) => (
          <li
            key={member.studentId}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
          >
            <span className="min-w-0">
              <span className="block font-medium">{member.studentName}</span>
              <span className="block text-xs break-words text-muted-foreground">
                {member.studentEmail}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              aria-label={`Remove ${member.studentName} from ${programme?.code ?? ''}`}
              onClick={() => {
                setRemoving(member)
              }}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <Dialog
        open={programme !== null}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>{`Students in ${programme?.code ?? ''}`}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {programme?.name}
          </DialogDescription>
          {body()}
        </DialogContent>
      </Dialog>
      {removing && programme && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setRemoving(null)
          }}
          title={`Remove ${removing.studentName}?`}
          description={`They leave ${programme.code} and its courses. Their own notes are kept, and they can ask to join a programme again.`}
          confirmLabel="Remove"
          onConfirm={() => {
            remove.mutate(removing.studentId, {
              onSuccess: () => {
                toast.success(`${removing.studentName} removed from ${programme.code}.`)
                setRemoving(null)
              },
              onError: (error) => {
                toast.error(programmeMessage(error))
                setRemoving(null)
              },
            })
          }}
        />
      )}
    </>
  )
}
