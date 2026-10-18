/**
 * The composer at the bottom of Home (D102): a "+" for the options, the note, and a send button.
 * Enter sends; Shift+Enter adds a line. The title field appears only when asked for.
 */

// Icons.
import { Plus, SendHorizontal } from 'lucide-react'
// Client-side links.
import { Link } from 'react-router'

// Standard button and the "+" menu.
import { Button } from '@conote/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conote/ui/dropdown-menu'
// The title field.
import { Input } from '@conote/ui/input'
// The longest title.
import { MAX_TITLE_LENGTH } from '@/lib/notes'

/** What the composer shows and calls. */
interface NoteComposerProps {
  // The typed note.
  value: string
  onChange: (value: string) => void
  // The typed title, and whether its field is showing.
  title: string
  onTitleChange: (title: string) => void
  showTitle: boolean
  // Send.
  onSubmit: () => void
  // Whether a save is under way.
  sending: boolean
  // "+" menu actions.
  onAddTitle: () => void
  onChangeClass: () => void
  // Where "Open the full editor" goes.
  fullEditorTo: string
}

/** The note composer. */
export function NoteComposer({
  value,
  onChange,
  title,
  onTitleChange,
  showTitle,
  onSubmit,
  sending,
  onAddTitle,
  onChangeClass,
  fullEditorTo,
}: Readonly<NoteComposerProps>) {
  // Whether there is anything to send.
  const canSend = value.trim() !== '' && !sending

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (canSend) onSubmit()
      }}
      className="space-y-2"
    >
      {/* The optional title. */}
      {showTitle && (
        <Input
          aria-label="Title"
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Title (optional)"
          onChange={(event) => {
            onTitleChange(event.target.value)
          }}
          className="rounded-full px-4"
        />
      )}
      <div className="flex items-end gap-1.5 rounded-[1.75rem] border bg-card p-1.5 shadow-sm">
        {/* The options. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="More options">
              <Plus aria-hidden="true" className="size-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onSelect={onAddTitle}>Add a title</DropdownMenuItem>
            <DropdownMenuItem onSelect={onChangeClass}>Change class</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={fullEditorTo}>Open the full editor</Link>
            </DropdownMenuItem>
            {/* Not built yet; said so instead of hidden. */}
            <DropdownMenuItem disabled>Photo of the board (soon)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* The note. It grows with the text, up to a few lines. */}
        <textarea
          aria-label="Note"
          rows={1}
          value={value}
          placeholder="Write a note…"
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
        {/* Send. */}
        <Button type="submit" size="icon" aria-label="Save note" disabled={!canSend}>
          <SendHorizontal aria-hidden="true" />
        </Button>
      </div>
    </form>
  )
}
