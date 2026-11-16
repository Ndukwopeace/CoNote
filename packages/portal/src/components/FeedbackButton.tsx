/**
 * The "Feedback" button in the staff portals' top bar (D125). It opens the shared feedback form and
 * sends through the app's feedback service, adding the page the sender was on (the path only, never
 * the query or the hash, which can hold a token).
 */

// The icon.
import { MessageSquarePlus } from 'lucide-react'
// The form's open state.
import { useState } from 'react'
// The page the sender is on.
import { useLocation } from 'react-router'

// The kinds, the limit and the page rule.
import {
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_MAX_LENGTH,
  pageOf,
  type FeedbackKind,
  type FeedbackService,
} from '@conote/core/feedback'
// The shared form and the button style.
import { Button } from '@conote/ui/button'
import { FeedbackDialog } from '@conote/ui/common/FeedbackDialog'

/** The kinds as the form lists them. */
const KINDS = FEEDBACK_KINDS.map((value) => ({ value, label: FEEDBACK_KIND_LABELS[value] }))

/** A top-bar button that opens the feedback form. */
export function FeedbackButton({ service }: Readonly<{ service: FeedbackService }>) {
  // Whether the form is showing.
  const [open, setOpen] = useState(false)
  // The page the sender is on, without a query or a hash.
  const { pathname } = useLocation()

  return (
    <>
      {/* The word hides on phones, where the icon and its name are enough. */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      >
        <MessageSquarePlus aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Feedback</span>
      </Button>
      <FeedbackDialog<FeedbackKind>
        open={open}
        onOpenChange={setOpen}
        kinds={KINDS}
        maxLength={FEEDBACK_MAX_LENGTH}
        onSend={(draft) => service.send({ ...draft, page: pageOf(pathname) })}
      />
    </>
  )
}
