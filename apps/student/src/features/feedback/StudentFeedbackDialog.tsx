/**
 * The student's feedback form (D125): the shared form, sending through the app's feedback service
 * with the page the student was on (the path only, never the query or the hash).
 */

// The page the student is on.
import { useLocation } from 'react-router'

// The kinds, the limit and the page rule.
import {
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_MAX_LENGTH,
  pageOf,
  type FeedbackKind,
} from '@conote/core/feedback'
// The shared form.
import { FeedbackDialog } from '@conote/ui/common/FeedbackDialog'
// The services.
import { useServices } from '@/services/useServices'

/** The kinds as the form lists them. */
const KINDS = FEEDBACK_KINDS.map((value) => ({ value, label: FEEDBACK_KIND_LABELS[value] }))

/** What the dialog needs: whether it shows, and the way to close it. */
interface StudentFeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The feedback form for a student. */
export function StudentFeedbackDialog({
  open,
  onOpenChange,
}: Readonly<StudentFeedbackDialogProps>) {
  // The app's feedback service, and the page the student is on.
  const { feedback } = useServices()
  const { pathname } = useLocation()
  return (
    <FeedbackDialog<FeedbackKind>
      open={open}
      onOpenChange={onOpenChange}
      kinds={KINDS}
      maxLength={FEEDBACK_MAX_LENGTH}
      onSend={(draft) => feedback.send({ ...draft, page: pageOf(pathname) })}
    />
  )
}
