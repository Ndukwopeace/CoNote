/**
 * Home in Note mode (D102, D103): the statement, the student's notes for the chosen class as a
 * stream (then the teacher-approved summary, once it is out), and above the composer the class
 * chip and the four tags.
 */

// State, refs and effects.
import { useEffect, useRef, useState } from 'react'
// Icon for the editing bar.
import { Pencil } from 'lucide-react'

// The "+" menu.
import { DropdownMenuItem } from '@conote/ui/dropdown-menu'
// Messages above a form.
import { FormMessage } from '@conote/ui/forms/FormMessage'
// The title field.
import { Input } from '@conote/ui/input'
// Data hooks.
import { useCreateNote, useUpdateNote } from '@/hooks/useNoteMutations'
import { useMyNotes } from '@/hooks/useNotes'
import { usePublishedSummaries } from '@/hooks/useSummaries'
// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown.
import { toAppError } from '@conote/core/errors'
// Note rules and the preset tags.
import {
  MAX_TITLE_LENGTH,
  PRESET_TAGS,
  hasRichFormatting,
  htmlToComposerText,
  otherTags,
  presetTag,
  textToNoteHtml,
  typedTitle,
} from '@/lib/notes'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shapes.
import type { ClassSession, Note } from '@/types/domain'

import { ClassChip } from './ClassChip'
import { Composer } from './Composer'
import { NoteBubble } from './NoteBubble'
import { Statement } from './Statement'
import { SummaryCard } from './SummaryCard'
import { useComposerDraft } from './useComposerDraft'

/** The notes stream, the tags and the composer for `chosen` (or no class yet). */
export function NoteMode({
  chosen,
  label,
  code,
  live,
  greeting,
  onOpenSheet,
  onAsk,
  editing,
  focusComposer,
  onEditDone,
}: Readonly<{
  chosen: ClassSession | undefined
  // "SWE 311 · SDLC Models", or null while no class is chosen.
  label: string | null
  // The course code, shown small after the name.
  code: string | null
  live: boolean
  greeting: string
  onOpenSheet: () => void
  onAsk: () => void
  // The note being edited, when the composer holds one instead of a new note.
  editing: Note | undefined
  // Whether the cursor goes into the composer when it appears.
  focusComposer: boolean
  // Leaves editing: after a save, or on Cancel.
  onEditDone: () => void
}>) {
  // The text: a draft kept per class for a new note, the note's own text while editing it.
  const drafts = useComposerDraft(chosen?.id, !editing)
  const [editText, setEditText] = useState(editing ? htmlToComposerText(editing.contentHtml) : '')
  const draft = editing ? editText : drafts.text
  const setDraft = editing ? setEditText : drafts.setText
  // The title (only a typed one is shown for an edit) and the tag.
  const [title, setTitle] = useState(editing ? typedTitle(editing) : '')
  const [showTitle, setShowTitle] = useState(editing ? typedTitle(editing) !== '' : false)
  const [tag, setTag] = useState<string | null>(editing ? presetTag(editing) : null)
  // A refusal, and what a screen reader is told after a save.
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  // The save.
  const create = useCreateNote()
  const update = useUpdateNote()
  // The student's notes for the chosen class, oldest first; none are read without a class.
  const notes = useMyNotes(chosen ? { classId: chosen.id } : {})
  const stream = chosen ? [...(notes.data ?? [])].reverse() : []
  // The class's approved summary, once published.
  const summaries = usePublishedSummaries()
  const summary = chosen ? summaries.data?.find((s) => s.classId === chosen.id) : undefined
  // Whether there is anything to show in the stream yet.
  const empty = stream.length === 0 && !summary
  // The end of the stream, kept in view as it grows.
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [stream.length, summary?.id])

  /** The title the note is saved with: the typed one, when the field is open. */
  const savedTitle = showTitle ? title : ''

  /** Saves the typed note under the chosen class, or the edit of the note being edited. */
  async function submit() {
    // No class to file it under: ask for one, keeping what was typed.
    if (!chosen) {
      onOpenSheet()
      return
    }
    setError(null)
    try {
      if (editing) {
        // An edit keeps the note's class and every tag the composer does not show.
        await update.mutateAsync({
          noteId: editing.id,
          input: {
            classId: editing.classId,
            title: savedTitle,
            contentHtml: textToNoteHtml(draft),
            tags: [...new Set([...otherTags(editing), ...(tag ? [tag] : [])])],
          },
        })
        // Back to writing a new note.
        onEditDone()
        return
      }
      await create.mutateAsync({
        classId: chosen.id,
        title: savedTitle,
        contentHtml: textToNoteHtml(draft),
        tags: tag ? [tag] : [],
      })
      // Saved: ready for the next thought, and no draft left to come back.
      drafts.clear()
      setTitle('')
      setTag(null)
      setAnnounce('Note saved.')
    } catch (error_) {
      // Refused or failed: say why, and keep what was typed.
      setError(errorMessage(toAppError(error_)))
    }
  }

  return (
    <>
      {/* The stream. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Statement greeting={greeting} fill={empty}>
          {empty &&
            (label ? (
              <p>
                Type a thought. It goes under <span className="text-foreground">{label}</span>.
              </p>
            ) : (
              <p>Choose a class below, then type a thought.</p>
            ))}
        </Statement>
        {!empty && (
          <div className="mt-auto flex flex-col gap-3 px-4 pb-3">
            {label && <p className="self-center text-xs text-muted-foreground">Today · {label}</p>}
            <ul className="flex flex-col gap-3">
              {stream.map((note) => (
                <NoteBubble key={note.id} note={note} editing={note.id === editing?.id} />
              ))}
            </ul>
            {summary && chosen && (
              <SummaryCard summary={summary} title={chosen.title} onAsk={onAsk} />
            )}
            <div ref={end} />
          </div>
        )}
      </div>

      {/* The class, the tags and the composer, pinned at the bottom. */}
      <div className="space-y-2 px-3 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Which note the composer holds, and the way out. */}
        {editing && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-2 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <Pencil aria-hidden="true" className="size-4" />
              Editing a note
            </span>
            <button
              type="button"
              aria-label="Cancel edit"
              onClick={onEditDone}
              className="min-h-11 rounded-full px-3 font-medium text-primary-dark outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Cancel
            </button>
          </div>
        )}
        {/* The composer keeps the words, not bold, lists or links from the old editor. */}
        {editing && hasRichFormatting(editing.contentHtml) && (
          <p className="px-1 text-sm text-muted-foreground">
            Bold and lists are removed when you edit a note here.
          </p>
        )}
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {/* Said to screen readers, not shown: the bubble is the visible confirmation. */}
        <output className="sr-only">{announce}</output>
        <div className="flex gap-2 overflow-x-auto px-1 pb-1">
          <ClassChip
            label={label}
            code={code}
            live={live}
            onClick={onOpenSheet}
            disabled={Boolean(editing)}
          />
          {PRESET_TAGS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={tag === preset}
              onClick={() => {
                setTag(tag === preset ? null : preset)
              }}
              className={cn(
                'min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                tag === preset
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'hover:border-primary',
              )}
            >
              {preset}
            </button>
          ))}
        </div>
        {showTitle && (
          <Input
            aria-label="Title"
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Title (optional)"
            onChange={(event) => {
              setTitle(event.target.value)
            }}
            className="rounded-full px-4"
          />
        )}
        <Composer
          label="Note"
          placeholder="Write a note…"
          sendLabel="Save note"
          value={draft}
          onChange={(value) => {
            setDraft(value)
            setAnnounce('')
          }}
          onSubmit={() => void submit()}
          busy={create.isPending || update.isPending}
          focusOnMount={focusComposer || Boolean(editing)}
          menu={
            <>
              <DropdownMenuItem
                onSelect={() => {
                  setShowTitle(true)
                }}
              >
                Add a title
              </DropdownMenuItem>
              {!editing && <DropdownMenuItem onSelect={onOpenSheet}>Change class</DropdownMenuItem>}
              {/* Not built yet; said so instead of hidden. */}
              <DropdownMenuItem disabled>Photo of the board (soon)</DropdownMenuItem>
            </>
          }
        />
      </div>
    </>
  )
}
