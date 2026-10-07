/**
 * The iOS install steps (FR-PWA-6). iOS offers no install prompt, so the "Install app" item
 * explains the two taps instead.
 */

// The Share and "Add to Home Screen" icons, as iOS draws them.
import { Share, SquarePlus } from 'lucide-react'

// Modal dialog parts.
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@conote/ui/dialog'

/** Whether the dialog is open, and how to close it. */
interface IosInstallDialogProps {
  // Open or closed; the menu controls it.
  open: boolean
  // Called with false when the student closes it.
  onOpenChange: (open: boolean) => void
}

/** Two numbered steps for adding CoNote to the home screen on iPhone or iPad. */
export function IosInstallDialog({ open, onOpenChange }: Readonly<IosInstallDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* The dialog's name, read out when it opens. */}
        <DialogTitle>Install CoNote</DialogTitle>
        {/* What the steps achieve. */}
        <DialogDescription>
          Add CoNote to your home screen to open it like an app.
        </DialogDescription>
        {/* The steps, numbered by the list. */}
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          {/* Step 1: the Share button. The icon matches what the student looks for. */}
          <li>
            Tap <strong>Share</strong>{' '}
            <Share aria-hidden="true" className="inline size-4 align-text-bottom" /> in the browser
            toolbar.
          </li>
          {/* Step 2: the menu entry. */}
          <li>
            Choose <strong>Add to Home Screen</strong>{' '}
            <SquarePlus aria-hidden="true" className="inline size-4 align-text-bottom" />, then tap{' '}
            <strong>Add</strong>.
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  )
}
