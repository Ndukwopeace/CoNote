/**
 * A confirmation for something deleted for good: the person must type a name (a course code, an
 * account's name) before the button turns on. A plain yes/no is too easy to click through when
 * the loss is students' notes. Built on Radix AlertDialog like ConfirmDialog, so focus is
 * trapped, Cancel is focused first and an outside click doesn't close it.
 */

// The typed text.
import { useState } from 'react'
// Radix's accessible alert dialog.
import { AlertDialog } from 'radix-ui'

// Button and field styles.
import { buttonVariants } from '../components/button'
import { Input } from '../components/input'

/** What the dialog asks and does. */
interface TypeToConfirmDialogProps {
  // Whether it is showing.
  open: boolean
  // Called with false when it closes (Cancel or Escape).
  onOpenChange: (open: boolean) => void
  // The question, e.g. "Delete CSC 101 for good?".
  title: string
  // The consequence, in plain words.
  description: string
  // The words that must be typed, e.g. the course code.
  expected: string
  // The confirm button's words, e.g. "Delete course".
  confirmLabel: string
  // Runs when the right words were typed and the button was pressed.
  onConfirm: () => void
}

/** Whether `typed` matches `expected`, ignoring letter case and spaces at either end. */
function matches(typed: string, expected: string) {
  return typed.trim().toLowerCase() === expected.trim().toLowerCase()
}

/** A centred confirmation whose red button stays off until `expected` is typed. */
export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  expected,
  confirmLabel,
  onConfirm,
}: Readonly<TypeToConfirmDialogProps>) {
  // What has been typed so far.
  const [typed, setTyped] = useState('')

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        {/* Dimmed backdrop. */}
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        {/* The box: centred, 32 px narrower than a phone screen, 448 px at most. */}
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 shadow-lg">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted-foreground">
            {description}
          </AlertDialog.Description>
          {/* The field that has to match. */}
          <label className="grid gap-1.5 text-sm font-medium">
            {`Type ${expected} to confirm`}
            <Input
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value)
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {/* Cancel; Radix focuses it first, so Enter never deletes by accident. */}
            <AlertDialog.Cancel className={buttonVariants({ variant: 'outline' })}>
              Cancel
            </AlertDialog.Cancel>
            {/* Off until the words match. */}
            <AlertDialog.Action
              className={buttonVariants({ variant: 'destructive' })}
              disabled={!matches(typed, expected)}
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
