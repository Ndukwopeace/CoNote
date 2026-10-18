/**
 * The working part of Home (D102): the student's notes for the chosen class as a stream, the
 * teacher-approved summary when it arrives, and the composer pinned at the bottom with the class
 * chip and the tags above it. In Ask mode the same space holds the AI chat for that class.
 */

// Tag state, refs and effects.
import { useEffect, useRef, useState } from 'react'
// The query string.
import { useSearchParams } from 'react-router'

// Messages above a form.
import { FormMessage } from '@conote/ui/forms/FormMessage'
// The "Preview" label (FR-AI-9).
import { PreviewBadge } from '@/components/common/PreviewBadge'
// The chat.
import { ChatPanel } from '@/features/ai/ChatPanel'
// Data hooks.
import { useCreateNote } from '@/hooks/useNoteMutations'
import { useMyNotes } from '@/hooks/useNotes'
import { useNow } from '@/hooks/useNow'
import { usePublishedSummaries } from '@/hooks/useSummaries'
// Class rules.
import { defaultNoteClass, getClassStatus, recentClasses } from '@/lib/classes'
// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown.
import { toAppError } from '@conote/core/errors'
// Note rules and the preset tags.
import { PRESET_TAGS, textToNoteHtml } from '@/lib/notes'
// Addresses.
import { ROUTES } from '@/lib/routes'
// Whether the AI is a demo (FR-AI-9).
import { useServices } from '@/services/useServices'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shapes.
import type { ClassSession, Course } from '@/types/domain'

import { ClassChip } from './ClassChip'
import { ClassSheet } from './ClassSheet'
import { NoteBubble } from './NoteBubble'
import { NoteComposer } from './NoteComposer'
import { SummaryCard } from './SummaryCard'

/** How many classes the class sheet offers. */
const SHEET_LIMIT = 12

/** Home's stream and composer for the student's `courses` and `classes`. */
export function HomeWorkspace({
  courses,
  classes,
  mode,
  onModeChange,
  greeting,
}: Readonly<{
  courses: Course[]
  classes: ClassSession[]
  mode: 'note' | 'ask'
  onModeChange: (mode: 'note' | 'ask') => void
  // "Good morning, Victory."
  greeting: string
}>) {
  // The class from the address (a link from a summary), if it is one of the student's.
  const [params] = useSearchParams()
  // The current time, for "On now".
  const now = useNow()
  // The chosen class: from the address, else the likely one. Worked out once, so a class
  // starting while the student types doesn't swap it.
  const [chosenId, setChosenId] = useState<string | null>(
    () =>
      classes.find((c) => c.id === params.get('classId'))?.id ??
      defaultNoteClass(classes, new Date())?.id ??
      null,
  )
  const chosen = classes.find((c) => c.id === chosenId)
  const course = courses.find((c) => c.id === chosen?.courseId)
  // "SWE 311 · SDLC Models".
  const label = chosen && course ? `${course.code} · ${chosen.title}` : null
  // Whether the class is on now.
  const live = chosen ? getClassStatus(chosen, now) === 'live' : false
  // The class sheet.
  const [sheetOpen, setSheetOpen] = useState(false)
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
  // The demo AI's replies are examples, so Ask says so (FR-AI-9).
  const { ai } = useServices()
  // The end of the stream, kept in view as it grows.
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [stream.length, summary?.id])

  /** Saves the typed note under the chosen class. */
  async function submit() {
    // No class to file it under: ask for one, keeping what was typed.
    if (!chosen) {
      setSheetOpen(true)
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
    } catch (failure) {
      // Refused or failed: say why, and keep what was typed.
      setError(errorMessage(toAppError(failure)))
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-17rem)] flex-col gap-4">
      {/* The statement and, in Note mode, what the next note does. */}
      <div
        className={cn(
          'flex flex-col items-center gap-2 text-center',
          // An empty stream centres the statement in the space above the composer.
          mode === 'note' && stream.length === 0 && !summary && 'flex-1 justify-center',
        )}
      >
        <h1 className="text-3xl font-bold tracking-tight">Let&apos;s CoNote</h1>
        <p className="text-muted-foreground">{greeting}</p>
        {mode === 'note' && stream.length === 0 && !summary && (
          <p className="mt-1 max-w-xs text-muted-foreground">
            {label ? (
              <>
                Type a thought. It goes under <span className="text-foreground">{label}</span>.
              </>
            ) : (
              'Choose a class below, then type a thought.'
            )}
          </p>
        )}
        {mode === 'ask' && ai.isPreview && <PreviewBadge />}
      </div>

      {mode === 'note' ? (
        <>
          {/* The stream: the student's notes, then the summary. */}
          {(stream.length > 0 || summary) && (
            <div className="flex flex-1 flex-col justify-end gap-3 pb-2">
              {label && (
                <p className="self-center text-xs text-muted-foreground">Today · {label}</p>
              )}
              <ul className="flex flex-col gap-3">
                {stream.map((note) => (
                  <NoteBubble key={note.id} note={note} />
                ))}
              </ul>
              {summary && chosen && (
                <SummaryCard
                  summary={summary}
                  title={chosen.title}
                  onAsk={() => {
                    onModeChange('ask')
                  }}
                />
              )}
              <div ref={end} />
            </div>
          )}
          {/* Composer, pinned above the phone bottom bar. */}
          <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 -mx-4 space-y-2 bg-background/95 px-4 pt-2 pb-2 backdrop-blur md:bottom-0 md:mx-0 md:px-0">
            {error && <FormMessage tone="error">{error}</FormMessage>}
            {/* Said to screen readers, not shown: the bubble is the visible confirmation. */}
            <output className="sr-only">{announce}</output>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <ClassChip
                label={label}
                live={live}
                onClick={() => {
                  setSheetOpen(true)
                }}
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
                      : 'bg-card hover:border-primary',
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <NoteComposer
              value={draft}
              onChange={(value) => {
                setDraft(value)
                setAnnounce('')
              }}
              title={title}
              onTitleChange={setTitle}
              showTitle={showTitle}
              onSubmit={() => void submit()}
              sending={create.isPending}
              onAddTitle={() => {
                setShowTitle(true)
              }}
              onChangeClass={() => {
                setSheetOpen(true)
              }}
              fullEditorTo={
                chosen
                  ? `${ROUTES.newNote}?classId=${encodeURIComponent(chosen.id)}`
                  : ROUTES.newNote
              }
            />
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          {/* Which class the questions are about. */}
          <div className="flex gap-2">
            <ClassChip
              label={label}
              live={live}
              onClick={() => {
                setSheetOpen(true)
              }}
            />
          </div>
          {/* The chat; a new class starts a new conversation. */}
          <ChatPanel
            key={chosen?.id ?? 'all'}
            context={
              chosen
                ? { scope: 'class', courseId: chosen.courseId, classId: chosen.id }
                : { scope: 'all' }
            }
            className="flex-1"
          />
        </div>
      )}

      <ClassSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        classes={recentClasses(classes, now, SHEET_LIMIT)}
        courses={courses}
        chosenId={chosenId}
        now={now}
        onChoose={(classId) => {
          setChosenId(classId)
          setSheetOpen(false)
        }}
      />
    </div>
  )
}
