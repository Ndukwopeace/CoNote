/**
 * The feedback form every app shares (D125): what it is about, a message, and an optional score
 * from 1 to 5. It knows nothing about where feedback goes; the app passes `onSend`. After a send it
 * says thank you, and Close puts it away. It is generic over the kinds, so the apps keep their own
 * typed list while the design system imports nothing from them.
 */

// The form's state.
import { useId, useState, type SyntheticEvent } from 'react'

// Button and field styles, and the dialog parts.
import { Button } from '../components/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../components/dialog'
import { NativeSelect } from '../components/native-select'
import { Textarea } from '../components/textarea'
// The red and green message boxes.
import { FormMessage } from '../forms/FormMessage'

/** One kind of feedback on offer. */
interface KindOption<K extends string> {
  value: K
  label: string
}

/** What the sender filled in. */
interface FeedbackDraft<K extends string> {
  kind: K
  message: string
  // 1 to 5, or null when no score was given.
  rating: number | null
}

/** What the dialog needs. */
interface FeedbackDialogProps<K extends string> {
  // Whether it is showing, and the way to close it.
  open: boolean
  onOpenChange: (open: boolean) => void
  // The kinds the sender chooses from; the first is the starting choice.
  kinds: readonly KindOption<K>[]
  // The longest message, shown as a counter.
  maxLength: number
  // Sends the feedback. A rejection's message is shown to the sender.
  onSend: (draft: FeedbackDraft<K>) => Promise<void>
}

/** The scores on offer. */
const SCORES = [1, 2, 3, 4, 5] as const

/** The words for one score, for the screen reader. */
const SCORE_WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Great'] as const

/** The form, or the thank-you after it was sent. */
function FeedbackForm<K extends string>({
  kinds,
  maxLength,
  onSend,
}: Readonly<Pick<FeedbackDialogProps<K>, 'kinds' | 'maxLength' | 'onSend'>>) {
  // Unique ids for the labels.
  const id = useId()
  // The fields, whether a send is under way, what went wrong, and whether it worked.
  const [kind, setKind] = useState<K | undefined>(kinds[0]?.value)
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  /** Sends the feedback, and shows the thanks or the reason it failed. */
  async function submit(event: SyntheticEvent) {
    event.preventDefault()
    if (kind === undefined) return
    setSending(true)
    setError(null)
    try {
      await onSend({ kind, message, rating })
      setSent(true)
    } catch (error_) {
      // The services' messages are written for people; anything else gets a plain line.
      setError(error_ instanceof Error ? error_.message : 'We could not send that. Try again.')
    } finally {
      setSending(false)
    }
  }

  // After a send: thanks and a way out.
  if (sent) {
    return (
      <div className="grid gap-4">
        <FormMessage tone="success">Thank you. Your feedback was sent.</FormMessage>
        <DialogClose asChild>
          <Button type="button">Close</Button>
        </DialogClose>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4" noValidate>
      {/* What it is about. */}
      <div className="grid gap-1 text-sm">
        <label htmlFor={`${id}-kind`} className="font-medium">
          What is it about?
        </label>
        <NativeSelect
          id={`${id}-kind`}
          value={kind}
          onChange={(event) => {
            setKind(kinds.find((option) => option.value === event.target.value)?.value)
          }}
        >
          {kinds.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {/* The message, with a counter. */}
      <div className="grid gap-1 text-sm">
        <label htmlFor={`${id}-message`} className="font-medium">
          Your message
        </label>
        <Textarea
          id={`${id}-message`}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value)
          }}
          maxLength={maxLength}
          rows={5}
          placeholder="Tell us what happened, or what would help."
        />
        <p className="text-right text-xs text-muted-foreground">
          {`${String(message.length)} / ${String(maxLength)}`}
        </p>
      </div>
      {/* The optional score. */}
      <fieldset className="grid gap-1 text-sm">
        <legend className="font-medium">How is CoNote working for you? (optional)</legend>
        <div className="flex gap-2">
          {SCORES.map((score) => (
            <label
              key={score}
              className="flex size-10 cursor-pointer items-center justify-center rounded-md border text-sm has-checked:border-primary has-checked:bg-primary-light has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name={`${id}-rating`}
                value={score}
                checked={rating === score}
                onChange={() => {
                  setRating(score)
                }}
                className="sr-only"
                aria-label={`${String(score)} of 5, ${SCORE_WORDS[score - 1] ?? ''}`}
              />
              <span aria-hidden="true">{score}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {/* Why it failed, when it did. */}
      {error !== null && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Send feedback'}
        </Button>
      </div>
    </form>
  )
}

/** The feedback dialog. A fresh form each time it opens, so old text never lingers. */
export function FeedbackDialog<K extends string>({
  open,
  onOpenChange,
  kinds,
  maxLength,
  onSend,
}: Readonly<FeedbackDialogProps<K>>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Send feedback</DialogTitle>
        <DialogDescription>
          Tell us what is broken or what would make CoNote better. The people who run CoNote read
          it, with your name.
        </DialogDescription>
        {/* Radix unmounts the content when closed, so the form starts empty on every opening. */}
        <FeedbackForm kinds={kinds} maxLength={maxLength} onSend={onSend} />
      </DialogContent>
    </Dialog>
  )
}
