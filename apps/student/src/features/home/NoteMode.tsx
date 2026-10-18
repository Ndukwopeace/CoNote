/**
 * Home in Note mode (D102, D103): the statement, the student's notes for the chosen class as a
 * stream (then the teacher-approved summary, once it is out), and above the composer the class
 * chip and the four tags.
 */

// State, refs and effects.
import { useEffect, useRef, useState } from 'react'
// Client-side links.
import { Link } from 'react-router'

// The "+" menu.
import { DropdownMenuItem } from '@conote/ui/dropdown-menu'
// Messages above a form.
import { FormMessage } from '@conote/ui/forms/FormMessage'
// The title field.
import { Input } from '@conote/ui/input'
// Data hooks.
import { useCreateNote } from '@/hooks/useNoteMutations'
import { useMyNotes } from '@/hooks/useNotes'
import { usePublishedSummaries } from '@/hooks/useSummaries'
// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown.
import { toAppError } from '@conote/core/errors'
// Note rules and the preset tags.
import { MAX_TITLE_LENGTH, PRESET_TAGS, textToNoteHtml } from '@/lib/notes'
// Addresses.
import { ROUTES } from '@/lib/routes'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shape.
import type { ClassSession } from '@/types/domain'

import { ClassChip } from './ClassChip'
import { Composer } from './Composer'
import { NoteBubble } from './NoteBubble'
import { Statement } from './Statement'
import { SummaryCard } from './SummaryCard'

/** The notes stream, the tags and the composer for `chosen` (or no class yet). */
export function NoteMode({
  chosen,
  label,
  live,
  greeting,
  onOpenSheet,
  onAsk,
}: Readonly<{
  chosen: ClassSession | undefined
  // "SWE 311 · SDLC Models", or null while no class is chosen.
  label: string | null
  live: boolean
  greeting: string
  onOpenSheet: () => void
  onAsk: () => void
}>) {
  // The composer's state.
  const [draft, setDraft] = useState('')
  const [title, setTitle] = useState('')
  const [showTitle, setShowTitle] = useState(false)
  const [tag, setTag] = useState<string | null>(null)
  // A refusal, and what a screen reader is told after a save.
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  // The save.
  const create = useCreateNote()
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

  /** Saves the typed note under the chosen class. */
  async function submit() {
    // No class to file it under: ask for one, keeping what was typed.
    if (!chosen) {
      onOpenSheet()
      return
    }
    setError(null)
    try {
      await create.mutateAsync({
        classId: chosen.id,
        title: showTitle ? title : '',
        contentHtml: textToNoteHtml(draft),
        tags: tag ? [tag] : [],
      })
      // Saved: ready for the next thought.
      setDraft('')
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
                <NoteBubble key={note.id} note={note} />
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
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {/* Said to screen readers, not shown: the bubble is the visible confirmation. */}
        <output className="sr-only">{announce}</output>
        <div className="flex gap-2 overflow-x-auto px-1 pb-1">
          <ClassChip label={label} live={live} onClick={onOpenSheet} />
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
          busy={create.isPending}
          menu={
            <>
              <DropdownMenuItem
                onSelect={() => {
                  setShowTitle(true)
                }}
              >
                Add a title
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenSheet}>Change class</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to={
                    chosen
                      ? `${ROUTES.newNote}?classId=${encodeURIComponent(chosen.id)}`
                      : ROUTES.newNote
                  }
                >
                  Open the full editor
                </Link>
              </DropdownMenuItem>
              {/* Not built yet; said so instead of hidden. */}
              <DropdownMenuItem disabled>Photo of the board (soon)</DropdownMenuItem>
            </>
          }
        />
      </div>
    </>
  )
}
