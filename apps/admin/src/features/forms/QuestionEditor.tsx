/**
 * One question in the builder (D126): its kind, its text, whether it is required, its choices where it
 * has them, and the buttons to move it or remove it. Once a form has answers, an answered question keeps
 * its kind and choices and cannot be removed, and the editor says so.
 */

// Icons for the buttons.
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

// Shared building blocks.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
import { NativeSelect } from '@conote/ui/native-select'
import { Textarea } from '@conote/ui/textarea'
// The kinds.
import {
  FORM_KIND_LABELS,
  FORM_LIMITS,
  FORM_QUESTION_KINDS,
  type FormQuestionDraft,
  type FormQuestionKind,
} from '@conote/core/forms'

/** A question in the builder, with a key React uses to tell questions apart. */
export interface EditableQuestion extends FormQuestionDraft {
  key: string
}

/** What one question editor needs. */
interface QuestionEditorProps {
  question: EditableQuestion
  // Where it sits, for its label and for the move buttons.
  index: number
  count: number
  // True when the question is saved and the form has answers: its kind and choices are fixed and it stays.
  locked: boolean
  // Whether another question already is the "Course and lecturer" one.
  lecturerTaken: boolean
  onChange: (question: EditableQuestion) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}

/** The kinds a question may be changed to: a second lecturer question is not on offer. */
function kindsFor(current: FormQuestionKind, lecturerTaken: boolean): readonly FormQuestionKind[] {
  return FORM_QUESTION_KINDS.filter(
    (kind) => kind !== 'lecturer' || current === 'lecturer' || !lecturerTaken,
  )
}

/** One question's fields. */
export function QuestionEditor({
  question,
  index,
  count,
  locked,
  lecturerTaken,
  onChange,
  onMove,
  onRemove,
}: Readonly<QuestionEditorProps>) {
  const number = String(index + 1)
  const hasChoices = question.kind === 'choice' || question.kind === 'dropdown'
  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 gap-1 text-sm">
          <label htmlFor={`${question.key}-prompt`} className="font-medium">
            {`Question ${number}`}
          </label>
          <Input
            id={`${question.key}-prompt`}
            value={question.prompt}
            maxLength={FORM_LIMITS.prompt}
            onChange={(event) => {
              onChange({ ...question, prompt: event.target.value })
            }}
          />
        </div>
        <div className="grid gap-1 text-sm">
          <label htmlFor={`${question.key}-kind`} className="font-medium">
            {`Type of question ${number}`}
          </label>
          <NativeSelect
            id={`${question.key}-kind`}
            value={question.kind}
            disabled={locked}
            onChange={(event) => {
              const kind = FORM_QUESTION_KINDS.find((value) => value === event.target.value)
              if (kind === undefined) return
              // Choices belong to the two kinds that have them; a new such question starts with two.
              const hasChoices = kind === 'choice' || kind === 'dropdown'
              const startingChoices =
                question.options.length >= 2 ? question.options : ['Option 1', 'Option 2']
              onChange({ ...question, kind, options: hasChoices ? startingChoices : [] })
            }}
          >
            {kindsFor(question.kind, lecturerTaken).map((kind) => (
              <option key={kind} value={kind}>
                {FORM_KIND_LABELS[kind]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {hasChoices && (
        <div className="grid gap-1 text-sm">
          <label htmlFor={`${question.key}-options`} className="font-medium">
            {`Choices for question ${number}, one on each line`}
          </label>
          <Textarea
            id={`${question.key}-options`}
            value={question.options.join('\n')}
            disabled={locked}
            rows={4}
            onChange={(event) => {
              onChange({ ...question, options: event.target.value.split('\n') })
            }}
          />
        </div>
      )}
      {question.kind === 'lecturer' && (
        <p className="text-xs text-muted-foreground">
          Students choose from the lecturers the timetable names for each course. Results are
          grouped by course and lecturer.
        </p>
      )}
      {locked && (
        <p className="text-xs text-muted-foreground">
          This question has answers, so its type and choices are fixed and it cannot be removed. You
          can still reword it.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(event) => {
              onChange({ ...question, required: event.target.checked })
            }}
          />
          {`Question ${number} is required`}
        </label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === 0}
            onClick={() => {
              onMove(-1)
            }}
            aria-label={`Move question ${number} up`}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === count - 1}
            onClick={() => {
              onMove(1)
            }}
            aria-label={`Move question ${number} down`}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={locked}
            onClick={onRemove}
            aria-label={`Remove question ${number}`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  )
}
