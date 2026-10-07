/**
 * Choosing a note's tags (FR-NTE-3): the four presets as toggle buttons, plus custom tags typed
 * in. Up to 10 tags of up to 30 characters (the rules live in lib/notes.ts).
 */

// Icons: plus to add, cross to remove.
import { Plus, X } from 'lucide-react'
// The custom tag text and its message.
import { useId, useState } from 'react'

// Standard button and input.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
// Tag rules and presets.
import { addTag, MAX_TAG_LENGTH, PRESET_TAGS } from '@/lib/notes'
// Class-name helper.
import { cn } from '@conote/ui/utils'

/** The picker's value and change handler. */
interface TagPickerProps {
  // The chosen tags.
  value: string[]
  // Called with the new list.
  onChange: (tags: string[]) => void
  // The form's error for the tags, if any.
  error?: string | undefined
}

/** True when `tag` is one of the presets (compared without case). */
function isPreset(tag: string) {
  return PRESET_TAGS.some((preset) => preset.toLowerCase() === tag.toLowerCase())
}

/** Preset toggles, the custom tag field and the custom tags chosen so far. */
export function TagPicker({ value, onChange, error }: Readonly<TagPickerProps>) {
  // The text in the custom tag field.
  const [draft, setDraft] = useState('')
  // Why the last custom tag was refused.
  const [message, setMessage] = useState<string | null>(null)
  // IDs linking the field to its message.
  const messageId = useId()
  // The message to show: the picker's own, else the form's.
  const shown = message ?? error

  /** Adds the typed tag, or explains why not. */
  function addDraft() {
    // Apply the tag rules.
    const result = addTag(value, draft)
    if (result.error) {
      setMessage(result.error)
      return
    }
    // Added: clear the field and the message.
    onChange(result.tags)
    setDraft('')
    setMessage(null)
  }

  return (
    <div className="space-y-3">
      {/* Presets: one tap each (FR-NTE-3). aria-pressed says which are on. A fieldset groups
          them natively; its legend names the group. */}
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Preset tags</legend>
        {PRESET_TAGS.map((preset) => {
          // On when already chosen.
          const on = value.includes(preset)
          return (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={on ? 'default' : 'outline'}
              aria-pressed={on}
              className={cn('rounded-full', on && 'font-semibold')}
              onClick={() => {
                // Toggle; adding goes through the rules so the 10-tag limit holds.
                if (on) {
                  onChange(value.filter((tag) => tag !== preset))
                  setMessage(null)
                  return
                }
                const result = addTag(value, preset)
                if (result.error) setMessage(result.error)
                else onChange(result.tags)
              }}
            >
              {preset}
            </Button>
          )
        })}
      </fieldset>

      {/* Custom tags chosen so far, each removable. */}
      {value.some((tag) => !isPreset(tag)) && (
        <ul aria-label="Your tags" className="flex flex-wrap gap-2">
          {value
            .filter((tag) => !isPreset(tag))
            .map((tag) => (
              <li
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-primary-light py-1 pr-1 pl-3 text-sm text-accent-foreground"
              >
                {/* The tag, as text. */}
                {tag}
                {/* Remove; named with the tag so screen readers know which. */}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => {
                    onChange(value.filter((t) => t !== tag))
                    setMessage(null)
                  }}
                  className="rounded-full p-1 outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
        </ul>
      )}

      {/* The custom tag field and its Add button. */}
      <div className="flex gap-2">
        <Input
          aria-label="Add your own tag"
          placeholder="Add your own tag"
          value={draft}
          maxLength={MAX_TAG_LENGTH + 1}
          {...(shown ? { 'aria-invalid': true, 'aria-describedby': messageId } : {})}
          onChange={(event) => {
            setDraft(event.target.value)
            setMessage(null)
          }}
          onKeyDown={(event) => {
            // Enter adds the tag instead of submitting the note.
            if (event.key === 'Enter') {
              event.preventDefault()
              addDraft()
            }
          }}
          className="sm:max-w-xs"
        />
        <Button type="button" variant="outline" onClick={addDraft} aria-label="Add tag">
          <Plus aria-hidden="true" />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </div>
      {/* Why a tag was refused, or the form's error. */}
      {shown && (
        <p id={messageId} className="text-sm text-error-strong">
          {shown}
        </p>
      )}
    </div>
  )
}
