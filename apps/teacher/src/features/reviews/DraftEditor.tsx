/**
 * The review form for a summary in review (teacher REQUIREMENTS section 9): every part of the
 * draft is editable, saving keeps the stage, and Approve & Publish asks first. Leaving with unsaved
 * edits asks first too.
 */

// Icons.
import { Plus, Trash2 } from 'lucide-react'
// Form state, and the guard that stops leaving with unsaved changes.
import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useBlocker } from 'react-router'
// Connects the zod rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'

// The shared error helpers.
import { reportError } from '@conote/core/reportError'
import { toAppError, type AppError } from '@conote/core/errors'
// Buttons, inputs and the confirmation.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
import { Textarea } from '@conote/ui/textarea'
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'
import { useToast } from '@conote/ui/toast'

// Sign-in state: signing out is never blocked.
import { useAuth } from '@conote/portal'
// Saving and publishing.
import { usePublishDraft, useSaveDraft } from '@/hooks/useReview'
// The draft's rules.
import { DRAFT_LIMITS, draftSchema } from '@/lib/draftSchema'
// Standard wording for failures.
import { errorMessage } from '@conote/portal'
// The shapes edited.
import type { ReviewDetails, SummaryDraft } from '@/types/review'

/** What the editor needs. */
interface DraftEditorProps {
  details: ReviewDetails
  // Loads the latest draft and restarts the form from it; used after a conflict.
  onReload: () => Promise<void>
}

/** The message for a draft that changed under the teacher. */
const STALE_MESSAGE = 'This draft changed. Reload to see the latest.'

/** A new item's ID: unique within the draft, and never reused. */
function newId(): string {
  return crypto.randomUUID()
}

/** The review form. */
export function DraftEditor({ details, onReload }: Readonly<DraftEditorProps>) {
  // Short confirmations.
  const toast = useToast()
  // Sign-in state, so signing out isn't held up by the unsaved-changes question.
  const auth = useAuth()
  // Saving and publishing.
  const save = useSaveDraft(details.summaryId)
  const publish = usePublishDraft(details.summaryId)
  // The last failure, or null.
  const [problem, setProblem] = useState<AppError | null>(null)
  // Whether the publish question is showing.
  const [confirming, setConfirming] = useState(false)

  // Form state with the draft's rules; errors show once a field has been left.
  const {
    register,
    handleSubmit,
    control,
    reset,
    trigger,
    getValues,
    formState: { errors, isDirty },
  } = useForm<SummaryDraft>({
    resolver: zodResolver(draftSchema),
    mode: 'onTouched',
    defaultValues: details.draft,
  })
  // The three lists. `keyName` keeps react-hook-form's own key apart from the item's `id`.
  const concepts = useFieldArray({ control, name: 'keyConcepts', keyName: 'fieldKey' })
  const confusions = useFieldArray({ control, name: 'confusionAreas', keyName: 'fieldKey' })
  const topics = useFieldArray({ control, name: 'keyTopics', keyName: 'fieldKey' })

  // Whether a save or publish is running, so neither can be pressed twice.
  const busy = save.isPending || publish.isPending

  // Leaving by any link with unsaved edits asks first. Signing out is never blocked.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && auth.status === 'signedIn' && currentLocation.pathname !== nextLocation.pathname,
  )

  // Closing or reloading the tab with unsaved edits asks first, through the browser's own prompt.
  useEffect(() => {
    // Nothing to protect.
    if (!isDirty) return undefined
    /** Asks the browser to confirm leaving. */
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    // Stop warning when the edits are saved or the form goes away.
    return () => {
      window.removeEventListener('beforeunload', warn)
    }
  }, [isDirty])

  /** Shows a failure and reports it. */
  function fail(error: unknown, where: string) {
    // SECURITY: only the safe wording reaches the screen; the details go to the reporter.
    reportError(error, { where })
    setProblem(toAppError(error))
  }

  // Save draft: validated by the form, then sent with the version the teacher loaded.
  const onSave = handleSubmit((values) => {
    setProblem(null)
    save.mutate(
      { draft: values, version: details.version },
      {
        onSuccess: (saved) => {
          // The saved text is the new starting point, so the form is no longer "unsaved".
          reset(saved.draft)
          toast.success('Draft saved.')
        },
        onError: (error) => {
          fail(error, 'DraftEditor.save')
        },
      },
    )
  })

  /** Approve & Publish: check the draft first, then ask. */
  async function askToPublish() {
    setProblem(null)
    // Blank required fields stop here, with their messages showing.
    if (await trigger()) setConfirming(true)
  }

  /** The teacher said yes: save and publish what is on screen. */
  function publishNow() {
    setConfirming(false)
    publish.mutate(
      { draft: getValues(), version: details.version },
      {
        onSuccess: () => {
          toast.success('Summary published.')
        },
        onError: (error) => {
          fail(error, 'DraftEditor.publish')
        },
      },
    )
  }

  return (
    <>
      <form
        onSubmit={(event) => void onSave(event)}
        noValidate
        aria-label="Summary draft"
        className="space-y-8"
      >
        {/* The overview. */}
        <FormField id="overview" label="Overview" error={errors.overview?.message}>
          {(control_) => (
            <Textarea rows={5} {...control_} {...register('overview')} disabled={busy} />
          )}
        </FormField>

        {/* Key concepts: a title and an explanation each. */}
        <ListSection
          title="Key concepts"
          addLabel="Add key concept"
          count={concepts.fields.length}
          disabled={busy}
          onAdd={() => {
            concepts.append({ id: newId(), title: '', explanation: '' })
          }}
        >
          {concepts.fields.map((field, index) => (
            <ListItem
              key={field.fieldKey}
              label={`concept ${String(index + 1)}`}
              disabled={busy}
              onRemove={() => {
                concepts.remove(index)
              }}
            >
              <FormField
                id={`concept-${String(index)}-title`}
                label={`Concept ${String(index + 1)} title`}
                error={errors.keyConcepts?.[index]?.title?.message}
              >
                {(control_) => (
                  <Input
                    {...control_}
                    {...register(`keyConcepts.${index}.title`)}
                    disabled={busy}
                  />
                )}
              </FormField>
              <FormField
                id={`concept-${String(index)}-explanation`}
                label={`Concept ${String(index + 1)} explanation`}
                error={errors.keyConcepts?.[index]?.explanation?.message}
              >
                {(control_) => (
                  <Textarea
                    rows={3}
                    {...control_}
                    {...register(`keyConcepts.${index}.explanation`)}
                    disabled={busy}
                  />
                )}
              </FormField>
            </ListItem>
          ))}
        </ListSection>

        {/* Common areas of confusion: the point and the clarification. */}
        <ListSection
          title="Common areas of confusion"
          addLabel="Add area of confusion"
          count={confusions.fields.length}
          disabled={busy}
          onAdd={() => {
            confusions.append({ id: newId(), issue: '', clarification: '' })
          }}
        >
          {confusions.fields.map((field, index) => (
            <ListItem
              key={field.fieldKey}
              label={`confusion ${String(index + 1)}`}
              disabled={busy}
              onRemove={() => {
                confusions.remove(index)
              }}
            >
              <FormField
                id={`confusion-${String(index)}-issue`}
                label={`Confusion ${String(index + 1)} point`}
                error={errors.confusionAreas?.[index]?.issue?.message}
              >
                {(control_) => (
                  <Input
                    {...control_}
                    {...register(`confusionAreas.${index}.issue`)}
                    disabled={busy}
                  />
                )}
              </FormField>
              <FormField
                id={`confusion-${String(index)}-clarification`}
                label={`Confusion ${String(index + 1)} clarification`}
                error={errors.confusionAreas?.[index]?.clarification?.message}
              >
                {(control_) => (
                  <Textarea
                    rows={3}
                    {...control_}
                    {...register(`confusionAreas.${index}.clarification`)}
                    disabled={busy}
                  />
                )}
              </FormField>
            </ListItem>
          ))}
        </ListSection>

        {/* Key topics: a name, and a description that may stay empty. */}
        <ListSection
          title="Key topics"
          addLabel="Add key topic"
          count={topics.fields.length}
          disabled={busy}
          onAdd={() => {
            topics.append({ id: newId(), name: '', description: '' })
          }}
        >
          {topics.fields.map((field, index) => (
            <ListItem
              key={field.fieldKey}
              label={`topic ${String(index + 1)}`}
              disabled={busy}
              onRemove={() => {
                topics.remove(index)
              }}
            >
              <FormField
                id={`topic-${String(index)}-name`}
                label={`Topic ${String(index + 1)} name`}
                error={errors.keyTopics?.[index]?.name?.message}
              >
                {(control_) => (
                  <Input {...control_} {...register(`keyTopics.${index}.name`)} disabled={busy} />
                )}
              </FormField>
              <FormField
                id={`topic-${String(index)}-description`}
                label={`Topic ${String(index + 1)} description (optional)`}
                error={errors.keyTopics?.[index]?.description?.message}
              >
                {(control_) => (
                  <Input
                    {...control_}
                    {...register(`keyTopics.${index}.description`)}
                    disabled={busy}
                  />
                )}
              </FormField>
            </ListItem>
          ))}
        </ListSection>

        {/* A failed save or publish. A changed draft offers Reload. */}
        {problem && (
          <FormMessage tone="error">
            {problem.kind === 'conflict' ? (
              <span className="flex flex-wrap items-center gap-3">
                {STALE_MESSAGE}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setProblem(null)
                    void onReload()
                  }}
                >
                  Reload
                </Button>
              </span>
            ) : (
              errorMessage(problem)
            )}
          </FormMessage>
        )}

        {/* The two actions. Publishing is the second and asks first. */}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="outline" disabled={busy}>
            {save.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void askToPublish()}>
            {publish.isPending ? 'Publishing…' : 'Approve & Publish'}
          </Button>
        </div>
      </form>

      {/* The publish question (teacher REQUIREMENTS section 2: it always asks first). */}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Publish this summary?"
        description={`Students in ${details.courseCode} will see it. Your latest edits are saved with it.`}
        confirmLabel="Approve & Publish"
        confirmVariant="default"
        onConfirm={publishNow}
      />

      {/* The unsaved-changes question, when a link was clicked mid-edit. */}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset()
        }}
        title="Leave without saving?"
        description="Your edits to this draft haven't been saved."
        confirmLabel="Leave"
        cancelLabel="Keep editing"
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </>
  )
}

/** A titled group of items with an "add" button. */
function ListSection({
  title,
  addLabel,
  count,
  disabled,
  onAdd,
  children,
}: Readonly<{
  title: string
  addLabel: string
  count: number
  disabled: boolean
  onAdd: () => void
  children: React.ReactNode
}>) {
  return (
    <section aria-label={title} className="space-y-3">
      {/* The group's heading. */}
      <h2 className="text-lg font-semibold">{title}</h2>
      {/* The items. */}
      <ul className="space-y-3">{children}</ul>
      {/* Adding stops at the limit. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || count >= DRAFT_LIMITS.items}
        onClick={onAdd}
      >
        <Plus aria-hidden="true" />
        {addLabel}
      </Button>
    </section>
  )
}

/** One editable item with its remove button. */
function ListItem({
  label,
  disabled,
  onRemove,
  children,
}: Readonly<{
  label: string
  disabled: boolean
  onRemove: () => void
  children: React.ReactNode
}>) {
  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      {/* The item's fields. */}
      {children}
      {/* Removing is undone by not saving, so it doesn't ask. */}
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
        <Trash2 aria-hidden="true" />
        Remove {label}
      </Button>
    </li>
  )
}
