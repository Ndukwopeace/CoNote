/**
 * The composer at the bottom of Home (D102, D103): a "+" for the options, the text, and a send
 * button, in one pill. Enter sends; Shift+Enter adds a line. Notes and questions use the same one.
 */

// Icons.
import { Plus, SendHorizontal } from 'lucide-react'
// The text box is focused on request.
import { useEffect, useRef, type ReactNode } from 'react'

// Standard button and the "+" menu.
import { Button } from '@conote/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@conote/ui/dropdown-menu'

/** What the composer shows and calls. */
interface ComposerProps {
  // What the field is called to assistive technology, e.g. "Note".
  label: string
  placeholder: string
  // The send button's name, e.g. "Save note".
  sendLabel: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  // Whether a send is under way, or the field is not ready for one.
  busy?: boolean
  // The "+" menu's items (DropdownMenuItem elements).
  menu: ReactNode
  // Puts the cursor in the box when the composer appears (a "New note" button, an edit).
  focusOnMount?: boolean
}

/** The composer. */
export function Composer({
  label,
  placeholder,
  sendLabel,
  value,
  onChange,
  onSubmit,
  busy = false,
  menu,
  focusOnMount = false,
}: Readonly<ComposerProps>) {
  // The text box, to focus.
  const field = useRef<HTMLTextAreaElement>(null)
  // On request, the cursor goes into the box, after any text already there.
  useEffect(() => {
    const box = field.current
    if (!focusOnMount || !box) return
    box.focus()
    box.setSelectionRange(box.value.length, box.value.length)
  }, [focusOnMount])
  // Whether there is anything to send.
  const canSend = value.trim() !== '' && !busy

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (canSend) onSubmit()
      }}
      className="flex items-end gap-1.5 rounded-[1.75rem] border bg-muted p-1.5"
    >
      {/* The options. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="More options">
            <Plus aria-hidden="true" className="size-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The text. It grows with what is typed, up to a few lines. */}
      <textarea
        ref={field}
        aria-label={label}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onKeyDown={(event) => {
          // Enter alone sends; while an input method is composing text, Enter belongs to it.
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            if (canSend) onSubmit()
          }
        }}
        className="field-sizing-content max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-base outline-none placeholder:text-muted-foreground"
      />
      {/* Send: indigo when there is something to send, grey otherwise. */}
      <Button type="submit" size="icon" aria-label={sendLabel} disabled={!canSend}>
        <SendHorizontal aria-hidden="true" />
      </Button>
    </form>
  )
}
