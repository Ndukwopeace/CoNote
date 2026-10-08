/**
 * A form in a dialog (admin REQUIREMENTS section 21): centred on larger screens, a sheet rising
 * from the bottom on phones, so the keyboard and the fields fit.
 */

// Children type.
import type { ReactNode } from 'react'

// The dialog parts.
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@conote/ui/dialog'

/** What the dialog shows. */
interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Names the dialog.
  title: string
  // One sentence on what the form does.
  description: string
  // The form.
  children: ReactNode
}

/** The dialog around a form. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: Readonly<FormDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* On phones: full width at the bottom, scrolling if the form is tall. */}
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none">
        {/* Title and description; they name and describe the dialog. */}
        <div className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-1">{description}</DialogDescription>
        </div>
        {/* The form. */}
        {children}
      </DialogContent>
    </Dialog>
  )
}
