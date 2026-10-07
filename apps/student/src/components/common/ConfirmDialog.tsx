/**
 * A yes/no question before something that can't be undone, such as deleting a note
 * (FR-NTE-8) or discarding unsaved changes (FR-NTE-5). Built on Radix AlertDialog, which traps
 * focus, focuses Cancel first and doesn't close on an outside click.
 */

// Radix's accessible alert dialog.
import { AlertDialog } from 'radix-ui'

// Button styles.
import { buttonVariants } from '@conote/ui/button'

/** What the dialog asks and does. */
interface ConfirmDialogProps {
  // Whether it is showing.
  open: boolean
  // Called with false when it closes (Cancel or Escape).
  onOpenChange: (open: boolean) => void
  // The question, e.g. "Delete this note?".
  title: string
  // The consequence, e.g. "This can't be undone."
  description: string
  // The confirm button's words, e.g. "Delete".
  confirmLabel: string
  // The cancel button's words; "Cancel" unless a clearer phrase fits, e.g. "Keep editing".
  cancelLabel?: string
  // Runs when the student confirms.
  onConfirm: () => void
}

/** A centred confirmation with Cancel and a red confirm button. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
}: Readonly<ConfirmDialogProps>) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {/* Rendered at the end of <body>, above everything. */}
      <AlertDialog.Portal>
        {/* Dimmed backdrop. */}
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        {/* The box: centred, 32 px narrower than a phone screen, 448 px at most. */}
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 shadow-lg">
          {/* The question; names the dialog. */}
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          {/* The consequence; describes the dialog. */}
          <AlertDialog.Description className="text-sm text-muted-foreground">
            {description}
          </AlertDialog.Description>
          {/* Buttons: stacked on phones (confirm on top), side by side from tablets up. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {/* Cancel; Radix focuses it first, so Enter never confirms by accident. */}
            <AlertDialog.Cancel className={buttonVariants({ variant: 'outline' })}>
              {cancelLabel}
            </AlertDialog.Cancel>
            {/* Confirm, in the destructive colour. */}
            <AlertDialog.Action
              className={buttonVariants({ variant: 'destructive' })}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
