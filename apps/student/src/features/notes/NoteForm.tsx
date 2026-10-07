/**
 * The note form for New and Edit (FR-NTE-1 to FR-NTE-6, FR-NTE-9): class, title, rich-text body
 * and tags, with drafts, an unsaved-changes guard and the published-summary notice.
 */

// Connects the shared note rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// Icons: draft banner, published notice.
import { FileClock, Info } from 'lucide-react'
// Refs, state and effects.
import { useEffect, useRef, useState } from 'react'
// Form state, and controlled fields for the editor and tag picker.
import { Controller, useForm, useWatch } from 'react-hook-form'
// Navigation, and the guard that stops leaving with unsaved changes.
import { useBlocker, useNavigate } from 'react-router'

// Yes/no dialog.
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// Labelled field and the error box.
import { FormField } from '@/components/forms/FormField'
import { FormMessage } from '@/components/forms/FormMessage'
// The body editor and tag picker.
import { RichTextEditor } from '@/components/notes/RichTextEditor'
import { TagPicker } from '@/components/notes/TagPicker'
// Standard button and input.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
// Sign-in state, so signing out isn't blocked.
import { useAuth } from '@/features/auth/useAuth'
// The flag the update toast reads.
import { setHasUnsavedChanges } from '@/features/pwa/unsavedChanges'
// Toast messages.
import { useToast } from '@/features/toast/useToast'
// Data hooks.
import { useMyClasses } from '@/hooks/useClasses'
import { useMyCourses } from '@/hooks/useCourses'
import { useCreateNote, useUpdateNote } from '@/hooks/useNoteMutations'
// Relative times for the draft banner.
import { formatRelativeTime } from '@/lib/dates'
// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown.
import { toAppError } from '@conote/core/errors'
// Draft keys.
import { draftKey } from '@/lib/noteDrafts'
// Note rules.
import { MAX_TITLE_LENGTH, noteInputSchema } from '@/lib/notes'
// Route constants and builders.
import { ROUTES, routeTo } from '@/lib/routes'
// Shapes.
import type { ClassSession, Course, Note } from '@/types/domain'

// Drafts for this form.
import { useNoteDraft } from './useNoteDraft'

/** Which note the form is for. */
export type NoteFormMode =
  // A new note, optionally for a known class.
  | { kind: 'new'; classId: string | null }
  // An existing note.
  | { kind: 'edit'; note: Note }

/** The form's values. */
interface NoteValues {
  classId: string
  title: string
  contentHtml: string
  tags: string[]
}

/** Loads the student's courses and classes, then shows the form. */
export function NoteForm({ mode }: Readonly<{ mode: NoteFormMode }>) {
  // The class list (for the picker, the label and the published notice).
  const courses = useMyCourses()
  const classes = useMyClasses()

  // Failed.
  const failed = courses.error ?? classes.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void courses.refetch()
          void classes.refetch()
        }}
      />
    )
  }
  // Loading.
  if (!courses.data || !classes.data) return <ListSkeleton rows={3} />

  // Loaded.
  return <NoteFormFields mode={mode} courses={courses.data} classes={classes.data} />
}

/** Where Cancel returns to: the note when editing, the class when known, otherwise Notes. */
function cancelTarget(mode: NoteFormMode, session: ClassSession | undefined) {
  if (mode.kind === 'edit') return routeTo.note(mode.note.id)
  if (session) return `${routeTo.class(session.courseId, session.id)}?tab=notes`
  return ROUTES.notes
}

/** The form itself. */
function NoteFormFields({
  mode,
  courses,
  classes,
}: Readonly<{ mode: NoteFormMode; courses: Course[]; classes: ClassSession[] }>) {
  // Navigation after save and cancel.
  const navigate = useNavigate()
  // Toasts.
  const toast = useToast()
  // Sign-in state.
  const auth = useAuth()
  // The save calls.
  const create = useCreateNote()
  const update = useUpdateNote()

  // SECURITY: a class from the address counts only if it is one of the student's classes, so a
  // crafted ?classId= can't preselect someone else's class.
  const startClassId =
    mode.kind === 'edit'
      ? mode.note.classId
      : (classes.find((c) => c.id === mode.classId)?.id ?? '')
  // The class fixed by where the form was opened from (edit, or new from a class).
  const fixedClass = classes.find((c) => c.id === startClassId)
  // The draft for this note or class (FR-NTE-5).
  const draft = useNoteDraft(
    mode.kind === 'edit' ? draftKey({ noteId: mode.note.id }) : draftKey({ classId: startClassId }),
  )

  // The form, checked with the same rules as the service. Errors show on submit, then as fixed.
  const form = useForm<NoteValues>({
    resolver: zodResolver(noteInputSchema),
    defaultValues:
      mode.kind === 'edit'
        ? {
            classId: mode.note.classId,
            title: mode.note.title ?? '',
            contentHtml: mode.note.contentHtml,
            tags: mode.note.tags,
          }
        : { classId: startClassId, title: '', contentHtml: '', tags: [] },
  })
  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    subscribe,
    formState: { errors, isDirty, isSubmitting },
  } = form

  // Remounts the editor when a draft is restored, so it shows the draft's HTML.
  const [editorKey, setEditorKey] = useState(0)
  // The service's refusal, shown above the form.
  const [serverError, setServerError] = useState<string | null>(null)
  // Whether the "discard changes?" dialog is open.
  const [confirmCancel, setConfirmCancel] = useState(false)
  // The course chosen in the picker (only used when no class was fixed).
  const [courseId, setCourseId] = useState('')
  // Set just before a deliberate exit (after save or discard), so the guard lets it through.
  const leaving = useRef(false)
  // Whether a student is signed in; signing out must never be blocked.
  const signedIn = auth.status === 'signedIn'

  // The class currently chosen.
  const classId = useWatch({ control, name: 'classId' })
  const session = classes.find((c) => c.id === classId)

  // Tell the update toast about unsaved changes; clear the flag when the form closes.
  useEffect(() => {
    setHasUnsavedChanges(isDirty)
  }, [isDirty])
  useEffect(
    () => () => {
      setHasUnsavedChanges(false)
    },
    [],
  )

  // Save a draft as the student types; not while a found draft is still on offer, which would
  // overwrite it before the student chooses.
  useEffect(() => {
    // subscribe() hands back its own unsubscribe, which the effect returns as its clean-up.
    return subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        if (draft.offered || leaving.current) return
        draft.schedule(values)
      },
    })
  }, [subscribe, draft])

  // Leaving by any link with unsaved changes asks first. Signing out is never blocked.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && signedIn && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  )

  /** Leaves on purpose: no guard, no unsaved flag. */
  function leave(to: string) {
    leaving.current = true
    setHasUnsavedChanges(false)
    void navigate(to)
  }

  /** Saves, then returns to the class's Notes tab (FR-NTE-6). */
  async function save(values: NoteValues) {
    setServerError(null)
    try {
      // Create or edit.
      const note =
        mode.kind === 'edit'
          ? await update.mutateAsync({ noteId: mode.note.id, input: values })
          : await create.mutateAsync(values)
      // Saved: the draft has done its job (FR-NTE-5).
      draft.clear()
      toast.success('Note saved.')
      leave(`${routeTo.class(note.courseId, note.classId)}?tab=notes`)
    } catch (error) {
      // Refused or failed: say why, keep everything typed (and the draft).
      setServerError(errorMessage(toAppError(error)))
    }
  }

  // Classes of the course chosen in the picker, in number order.
  const pickerClasses = classes
    .filter((c) => c.courseId === courseId)
    .sort((a, b) => a.number - b.number)
  // The course of a class, for labels.
  const courseOf = (c: ClassSession | undefined) =>
    courses.find((course) => course.id === c?.courseId)

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(save)(event)} className="space-y-6">
      {/* A draft from earlier (FR-NTE-5). */}
      {draft.offered && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning-soft bg-warning-soft/40 p-4 sm:flex-row sm:items-center">
          <FileClock aria-hidden="true" className="size-5 shrink-0 text-warning-strong" />
          <p className="flex-1 text-sm">
            You have an unsaved draft from{' '}
            {lowerFirst(formatRelativeTime(draft.offered.savedAt, new Date()))}.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                // Load the draft into the form, marked as changed, and redraw the editor.
                const restored = draft.restore()
                if (!restored) return
                const values = {
                  classId: restored.classId,
                  title: restored.title,
                  contentHtml: restored.contentHtml,
                  tags: restored.tags,
                }
                reset(values, { keepDefaultValues: true })
                setCourseId(courseOf(classes.find((c) => c.id === values.classId))?.id ?? '')
                setEditorKey((k) => k + 1)
              }}
            >
              Restore
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={draft.clear}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* FR-NTE-9: edits don't change a summary that is already out. */}
      {mode.kind === 'edit' && session?.summaryStatus === 'published' && (
        <p className="flex items-start gap-2 rounded-lg bg-primary-light px-4 py-3 text-sm text-accent-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          The summary for this class is already published. Your changes won&apos;t alter it.
        </p>
      )}

      {/* The service's refusal. */}
      {serverError && <FormMessage tone="error">{serverError}</FormMessage>}

      {/* The class: a fixed label when known, otherwise course → class pickers (FR-NTE-1). */}
      {fixedClass ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">Class</p>
          <p className="text-sm text-muted-foreground">
            {courseOf(fixedClass)?.code} · {fixedClass.title}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="note-course" label="Course">
            {(field) => (
              <select
                {...field}
                value={courseId}
                onChange={(event) => {
                  // A new course clears the class, which belonged to the old one.
                  setCourseId(event.target.value)
                  setValue('classId', '', { shouldDirty: true })
                }}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm"
              >
                <option value="">Choose a course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} · {course.title}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField id="note-class" label="Class" error={errors.classId?.message}>
            {(field) => (
              <select
                {...field}
                {...register('classId')}
                disabled={courseId === ''}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm disabled:opacity-60 aria-invalid:border-error"
              >
                <option value="">Choose a class</option>
                {pickerClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number}. {c.title}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
      )}

      {/* Title; optional (FR-NTE-1). */}
      <FormField id="note-title" label="Title (optional)" error={errors.title?.message}>
        {(field) => (
          <Input
            {...field}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Left blank, the first line is used"
            {...register('title')}
          />
        )}
      </FormField>

      {/* The body (FR-NTE-2, FR-NTE-4). */}
      <div className="space-y-1.5">
        <span id="note-body-label" className="text-sm font-medium">
          Note
        </span>
        <Controller
          control={control}
          name="contentHtml"
          render={({ field }) => (
            <RichTextEditor
              key={editorKey}
              id="note-body"
              labelledBy="note-body-label"
              initialHtml={field.value}
              onChange={field.onChange}
              invalid={errors.contentHtml !== undefined}
              {...(errors.contentHtml ? { describedBy: 'note-body-error' } : {})}
            />
          )}
        />
        {errors.contentHtml && (
          <p id="note-body-error" className="text-sm text-error-strong">
            {errors.contentHtml.message}
          </p>
        )}
      </div>

      {/* Tags (FR-NTE-3). */}
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">Tags</legend>
        <Controller
          control={control}
          name="tags"
          render={({ field }) => (
            <TagPicker value={field.value} onChange={field.onChange} error={errors.tags?.message} />
          )}
        />
      </fieldset>

      {/* Cancel and Save; Save is last, the primary action on the right. */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // Nothing to lose: leave at once. Otherwise ask (FR-NTE-5).
            if (isDirty) setConfirmCancel(true)
            else leave(cancelTarget(mode, fixedClass))
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save Note'}
        </Button>
      </div>

      {/* Cancel with changes: discarding also deletes the draft (FR-NTE-5). */}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Discard your changes?"
        description="Your changes to this note will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          draft.clear()
          leave(cancelTarget(mode, fixedClass))
        }}
      />

      {/* Leaving by a link with changes: the draft is kept, so nothing is lost. */}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset()
        }}
        title="Leave without saving?"
        description="Your draft stays on this device for 7 days, and you can restore it when you come back."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => {
          if (blocker.state === 'blocked') {
            setHasUnsavedChanges(false)
            blocker.proceed()
          }
        }}
      />
    </form>
  )
}

/** "Just now" → "just now", for use mid-sentence; dates such as "20 Sep" are unchanged. */
function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
