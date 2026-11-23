/**
 * One form in the builder (D126): its title and description, whether it is taking answers and between
 * which dates, its questions, a preview of what students see, and the link to share. Saving sends the
 * whole form. A form that has answers keeps its questions' types and choices and cannot lose a question.
 */

// Icons.
import { ArrowLeft, Plus } from 'lucide-react'
// Local state.
import { useState } from 'react'
// Links, moving on after a delete, and the ID in the address.
import { Link, useNavigate, useParams } from 'react-router'

// The tab title, the dialogs, buttons, fields and loading blocks.
import { PageTitle } from '@conote/ui/common/PageTitle'
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
import { FormFiller } from '@conote/ui/common/FormFiller'
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
import { NativeSelect } from '@conote/ui/native-select'
import { Skeleton } from '@conote/ui/skeleton'
import { Textarea } from '@conote/ui/textarea'
// The rules and kinds.
import {
  FORM_KIND_LABELS,
  FORM_LIMITS,
  FORM_QUESTION_KINDS,
  answersProblem,
  formProblem,
  type FormQuestionKind,
} from '@conote/core/forms'
// Load-failure panel.
import { ErrorState } from '@conote/portal'

// The pieces of the builder.
import { QuestionEditor, type EditableQuestion } from '@/features/forms/QuestionEditor'
import { ShareLink } from '@/features/forms/ShareLink'
// The data.
import { useDeleteForm, useForm, useSaveForm } from '@/hooks/useForms'
// Dates and links.
import { fromLocalInput, toLocalInput } from '@/lib/forms'
import { ADMIN_ROUTES, routeTo } from '@/lib/routes'
// The shapes.
import type { AdminForm } from '@/types/forms'

/** The link back to the list. */
function BackLink() {
  return (
    <Link
      to={ADMIN_ROUTES.forms}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      All forms
    </Link>
  )
}

/** A counter for the keys of questions added in this session. */
let addedQuestions = 0

/** The builder for a loaded form. */
function Editor({
  form,
  saved,
  onSaved,
}: Readonly<{ form: AdminForm; saved: boolean; onSaved: () => void }>) {
  const navigate = useNavigate()
  const save = useSaveForm()
  const remove = useDeleteForm()
  // The fields, and the questions with a key each. Saved questions are keyed by their ID.
  const [title, setTitle] = useState(form.title)
  const [description, setDescription] = useState(form.description)
  const [accepting, setAccepting] = useState(form.accepting)
  const [opensAt, setOpensAt] = useState(toLocalInput(form.opensAt))
  const [closesAt, setClosesAt] = useState(toLocalInput(form.closesAt))
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    form.questions.map((question) => ({ ...question, key: question.id })),
  )
  // The kind the next added question will have, what is wrong, and whether the delete box is open.
  const [nextKind, setNextKind] = useState<FormQuestionKind>('rating')
  const [problem, setProblem] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Questions that were saved while the form has answers keep their kind and cannot go.
  const savedIds = new Set(form.questions.map((question) => question.id))
  const locked = (question: EditableQuestion) =>
    form.responseCount > 0 && question.id !== undefined && savedIds.has(question.id)
  const lecturerCount = questions.filter((question) => question.kind === 'lecturer').length

  /** The form as it will be saved. */
  function draft() {
    return {
      id: form.id,
      title,
      description,
      accepting,
      opensAt: fromLocalInput(opensAt),
      closesAt: fromLocalInput(closesAt),
      questions: questions.map((question) => ({
        id: question.id,
        kind: question.kind,
        prompt: question.prompt,
        required: question.required,
        options: question.options,
      })),
    }
  }

  /** Checks the form and saves it. */
  function submit() {
    const next = draft()
    const found = formProblem(next)
    if (found !== null) {
      setProblem(found)
      return
    }
    if (
      next.opensAt !== null &&
      next.closesAt !== null &&
      Date.parse(next.closesAt) <= Date.parse(next.opensAt)
    ) {
      setProblem('The form must close after it opens.')
      return
    }
    setProblem(null)
    save.mutate(next, { onSuccess: onSaved })
  }

  /** Replaces the question at `index`. */
  function change(index: number, question: EditableQuestion) {
    setQuestions((current) => current.map((item, at) => (at === index ? question : item)))
  }
  /** Moves the question at `index` one place up or down. */
  function move(index: number, by: -1 | 1) {
    setQuestions((current) => {
      const next = [...current]
      const target = index + by
      const [item] = next.splice(index, 1)
      if (item !== undefined) next.splice(target, 0, item)
      return next
    })
  }
  /** Adds a question of the chosen kind at the end. */
  function add() {
    addedQuestions += 1
    setQuestions((current) => [
      ...current,
      {
        key: `new-${String(addedQuestions)}`,
        kind: nextKind,
        prompt: '',
        required: false,
        options: nextKind === 'choice' || nextKind === 'dropdown' ? ['Option 1', 'Option 2'] : [],
      },
    ])
  }

  // What students will see, built from what is on screen now.
  const preview = {
    title,
    description,
    lecturers: form.lecturers,
    questions: questions.map((question) => ({
      id: question.id ?? question.key,
      kind: question.kind,
      prompt: question.prompt.trim() === '' ? '(Question text)' : question.prompt,
      required: question.required,
      options: question.options.map((option) => option.trim()).filter((option) => option !== ''),
    })),
  }

  return (
    <div className="space-y-8">
      <PageTitle title={form.title} />
      <header className="space-y-3">
        <BackLink />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold">{form.title}</h1>
          <Link
            to={routeTo.formResults(form.id)}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {`View responses (${String(form.responseCount)})`}
          </Link>
        </div>
      </header>

      <section aria-label="Settings" className="space-y-4">
        <div className="grid gap-1 text-sm">
          <label htmlFor="form-title" className="font-medium">
            Title
          </label>
          <Input
            id="form-title"
            value={title}
            maxLength={FORM_LIMITS.title}
            onChange={(event) => {
              setTitle(event.target.value)
            }}
          />
        </div>
        <div className="grid gap-1 text-sm">
          <label htmlFor="form-description" className="font-medium">
            Description
          </label>
          <Textarea
            id="form-description"
            rows={3}
            value={description}
            maxLength={FORM_LIMITS.description}
            onChange={(event) => {
              setDescription(event.target.value)
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={accepting}
            onChange={(event) => {
              setAccepting(event.target.checked)
            }}
          />
          Accepting responses
        </label>
        <div className="flex flex-wrap gap-4">
          <div className="grid gap-1 text-sm">
            <label htmlFor="form-opens" className="font-medium">
              Opens (optional)
            </label>
            <Input
              id="form-opens"
              type="datetime-local"
              value={opensAt}
              onChange={(event) => {
                setOpensAt(event.target.value)
              }}
            />
          </div>
          <div className="grid gap-1 text-sm">
            <label htmlFor="form-closes" className="font-medium">
              Closes (optional)
            </label>
            <Input
              id="form-closes"
              type="datetime-local"
              value={closesAt}
              onChange={(event) => {
                setClosesAt(event.target.value)
              }}
            />
          </div>
        </div>
        <ShareLink token={form.token} />
      </section>

      <section aria-label="Questions" className="space-y-3">
        <h2 className="text-lg font-semibold">Questions</h2>
        <ol className="space-y-3">
          {questions.map((question, index) => (
            <QuestionEditor
              key={question.key}
              question={question}
              index={index}
              count={questions.length}
              locked={locked(question)}
              lecturerTaken={lecturerCount > 0}
              onChange={(next) => {
                change(index, next)
              }}
              onMove={(by) => {
                move(index, by)
              }}
              onRemove={() => {
                setQuestions((current) => current.filter((_item, at) => at !== index))
              }}
            />
          ))}
        </ol>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1 text-sm">
            <label htmlFor="next-kind" className="font-medium">
              New question type
            </label>
            <NativeSelect
              id="next-kind"
              value={nextKind}
              onChange={(event) => {
                setNextKind(
                  FORM_QUESTION_KINDS.find((kind) => kind === event.target.value) ?? 'rating',
                )
              }}
            >
              {FORM_QUESTION_KINDS.filter((kind) => kind !== 'lecturer' || lecturerCount === 0).map(
                (kind) => (
                  <option key={kind} value={kind}>
                    {FORM_KIND_LABELS[kind]}
                  </option>
                ),
              )}
            </NativeSelect>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={add}
            disabled={questions.length >= FORM_LIMITS.questions}
          >
            <Plus aria-hidden="true" />
            Add question
          </Button>
        </div>
      </section>

      <div className="space-y-2">
        {problem !== null && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            {save.error.message}
          </p>
        )}
        {saved && !save.isPending && (
          <p role="status" className="text-sm text-success-strong">
            Saved.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save form'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirmDelete(true)
            }}
          >
            Delete form
          </Button>
        </div>
      </div>

      <section aria-label="Preview" className="space-y-3">
        <h2 className="text-lg font-semibold">Preview</h2>
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-xl font-bold">{title}</h3>
          {description.trim() !== '' && (
            <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{description}</p>
          )}
          <div className="mt-5">
            <FormFiller
              key={preview.questions.map((question) => `${question.id}:${question.kind}`).join('|')}
              form={preview}
              preview
              problem={(answers) => answersProblem(preview.questions, preview.lecturers, answers)}
              onSubmit={() => Promise.resolve()}
            />
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this form?"
        description={
          form.responseCount > 0
            ? `This deletes the form and its ${String(form.responseCount)} responses for good.`
            : 'This deletes the form for good.'
        }
        confirmLabel="Delete form"
        onConfirm={() => {
          remove.mutate(form.id, {
            onSuccess: () => {
              void navigate(ADMIN_ROUTES.forms)
            },
          })
        }}
      />
    </div>
  )
}

/** The form builder page. */
export function FormEditorPage() {
  // The form's ID, from the address.
  const { formId = '' } = useParams()
  const { data, isPending, error, refetch, dataUpdatedAt } = useForm(formId)
  // Whether a save just worked, kept here so the editor can start fresh from the saved form.
  const [saved, setSaved] = useState(false)

  if (error) {
    // A form that does not exist says so; anything else offers a retry.
    return error.kind === 'not_found' ? (
      <div className="space-y-3">
        <PageTitle title="Form not found" />
        <BackLink />
        <p>We could not find that form. It may have been deleted.</p>
      </div>
    ) : (
      <ErrorState thing="the form" onRetry={() => void refetch()} />
    )
  }
  if (isPending) {
    return (
      <output aria-label="Loading the form" className="block space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
      </output>
    )
  }
  // A new copy of the editor each time the form is reloaded, so a saved form's new questions have their IDs.
  return (
    <Editor
      key={dataUpdatedAt}
      form={data}
      saved={saved}
      onSaved={() => {
        setSaved(true)
      }}
    />
  )
}
