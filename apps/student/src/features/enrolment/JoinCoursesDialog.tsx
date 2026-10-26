/**
 * The "Join your programme" dialog (FR-ENR-1 to FR-ENR-3, D115): the student chooses the year they
 * study in, then asks to join one of that year's programmes. Joining needs an administrator's
 * approval, so nothing here enrols the student. There is no search for single courses: a student
 * belongs to one programme, which brings all of its courses.
 */

// Buttons and dialog parts.
import { Button } from '@conote/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@conote/ui/dialog'

// The year step and the programmes.
import { ProgrammePicker } from './ProgrammePicker'

/** What the dialog needs. */
interface JoinCoursesDialogProps {
  // Whether it is showing.
  open: boolean
  // Called with false when it closes (Not now, the corner button, Escape or a click outside).
  onOpenChange: (open: boolean) => void
}

/** The dialog. */
export function JoinCoursesDialog({ open, onOpenChange }: Readonly<JoinCoursesDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Scrolls inside the screen when the programmes are taller than a phone. */}
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        {/* The title names the dialog. */}
        <DialogTitle>Join your programme</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Choose the year you study in, then ask to join your programme. Once an administrator
          approves, you are added to all of its courses.
        </DialogDescription>
        {/* The year, then that year's programmes (D115). */}
        <ProgrammePicker />
        {/* Leave without asking, or when done. */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
