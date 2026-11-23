/**
 * The form a person fills in (D126): the public page uses it, and so does the admin's preview. It draws
 * each question by its kind (text, paragraph, choice, dropdown, a 1 to 5 rating, or the course and
 * lecturer dropdown), collects the answers and hands them to `onSubmit`. After a send it says thank you
 * and offers "Submit another response", which is how one student rates a second course. It knows nothing
 * about where answers go or how they are checked, so the design system imports nothing from the apps.
 */

// The form's state.
import { useId, useState, type SyntheticEvent } from 'react'

// Field and button styles.
import { Button } from '../components/button'
import { Input } from '../components/input'
import { NativeSelect } from '../components/native-select'
import { Textarea } from '../components/textarea'
// The red and green message boxes.
import { FormMessage } from '../forms/FormMessage'

/** One question to draw. */
export interface FillerQuestion {
  id: string
  kind: 'short' | 'paragraph' | 'choice' | 'dropdown' | 'rating' | 'lecturer'
  prompt: string
  required: boolean
  options: readonly string[]
}

/** One choice in the course and lecturer dropdown. */
export interface FillerLecturer {
  courseId: string
  courseCode: string
  courseTitle: string
  lecturer: string
}

/** What the form holds. */
export interface FillerForm {
  title: string
  description: string
  questions: readonly FillerQuestion[]
  lecturers: readonly FillerLecturer[]
}

/** The answers by question ID. */
export type FillerAnswers = Record<string, string | number | { courseId: string; lecturer: string }>

/** What the form needs. */
interface FormFillerProps {
  form: FillerForm
  // Sends the answers. A rejection's message is shown to the sender.
  onSubmit: (answers: FillerAnswers) => Promise<void>
  // What is wrong with the answers, in words, or null. Checked before a send.
  problem: (answers: FillerAnswers) => string | null
  // A preview shows the form but sends nothing.
  preview?: boolean
}

/** The scores on offer, and the words for each. */
const SCORES = [1, 2, 3, 4, 5] as const
const SCORE_WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const

/** The value a lecturer option carries in the dropdown. */
function optionValue(option: FillerLecturer): string {
  return `${option.courseId}::${option.lecturer}`
}

/** The dropdown's options, grouped by course. */
function LecturerOptions({ options }: Readonly<{ options: readonly FillerLecturer[] }>) {
  // The courses in the order they first appear.
  const courses = [...new Set(options.map((option) => option.courseId))]
  return (
    <>
      <option value="">Choose a course and lecturer</option>
      {courses.map((courseId) => {
        const group = options.filter((option) => option.courseId === courseId)
        const first = group[0]
        return (
          <optgroup
            key={courseId}
            label={`${first?.courseCode ?? ''} · ${first?.courseTitle ?? ''}`}
          >
            {group.map((option) => (
              <option key={optionValue(option)} value={optionValue(option)}>
                {`${option.courseCode} · ${option.lecturer}`}
              </option>
            ))}
          </optgroup>
        )
      })}
    </>
  )
}

/** One question and its field. */
function Field({
  question,
  lecturers,
  value,
  onChange,
}: Readonly<{
  question: FillerQuestion
  lecturers: readonly FillerLecturer[]
  value: FillerAnswers[string] | undefined
  onChange: (value: FillerAnswers[string] | undefined) => void
}>) {
  // A unique id for the label.
  const id = useId()
  const label = (
    <span className="font-medium">
      {question.prompt}
      {question.required && (
        <span aria-hidden="true" className="text-destructive">
          {' *'}
        </span>
      )}
    </span>
  )
  const requiredNote = question.required ? <span className="sr-only"> (required)</span> : null

  // Choice and rating are groups of radio buttons, so they get a fieldset and a legend.
  if (question.kind === 'choice' || question.kind === 'rating') {
    const choices: readonly (string | number)[] =
      question.kind === 'rating' ? SCORES : question.options
    return (
      <fieldset className="grid gap-2 text-sm">
        <legend>
          {label}
          {requiredNote}
        </legend>
        <div className={question.kind === 'rating' ? 'flex flex-wrap gap-2' : 'grid gap-1'}>
          {choices.map((choice) => (
            <label
              key={String(choice)}
              className={
                question.kind === 'rating'
                  ? 'flex size-10 cursor-pointer items-center justify-center rounded-md border has-checked:border-primary has-checked:bg-primary-light has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50'
                  : 'flex cursor-pointer items-center gap-2'
              }
            >
              <input
                type="radio"
                name={id}
                checked={value === choice}
                onChange={() => {
                  onChange(choice)
                }}
                className={question.kind === 'rating' ? 'sr-only' : undefined}
                aria-label={
                  question.kind === 'rating'
                    ? `${String(choice)} of 5, ${SCORE_WORDS[Number(choice) - 1] ?? ''}`
                    : undefined
                }
              />
              <span aria-hidden={question.kind === 'rating' ? 'true' : undefined}>
                {String(choice)}
              </span>
            </label>
          ))}
        </div>
        {question.kind === 'rating' && (
          <p className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
            <span>1 · Poor</span>
            <span>5 · Excellent</span>
          </p>
        )}
      </fieldset>
    )
  }

  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id}>
        {label}
        {requiredNote}
      </label>
      {question.kind === 'short' && (
        <Input
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          maxLength={300}
        />
      )}
      {question.kind === 'paragraph' && (
        <Textarea
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          maxLength={2000}
          rows={4}
        />
      )}
      {question.kind === 'dropdown' && (
        <NativeSelect
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => {
            onChange(event.target.value === '' ? undefined : event.target.value)
          }}
        >
          <option value="">Choose</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      )}
      {question.kind === 'lecturer' && (
        <NativeSelect
          id={id}
          value={
            typeof value === 'object'
              ? optionValue({
                  courseId: value.courseId,
                  courseCode: '',
                  courseTitle: '',
                  lecturer: value.lecturer,
                })
              : ''
          }
          onChange={(event) => {
            const chosen = lecturers.find((option) => optionValue(option) === event.target.value)
            onChange(chosen ? { courseId: chosen.courseId, lecturer: chosen.lecturer } : undefined)
          }}
        >
          <LecturerOptions options={lecturers} />
        </NativeSelect>
      )}
    </div>
  )
}

/** A form to fill in, with its thank-you and "Submit another response". */
export function FormFiller({
  form,
  onSubmit,
  problem,
  preview = false,
}: Readonly<FormFillerProps>) {
  // The answers so far, whether a send is under way, what went wrong, and whether it worked.
  const [answers, setAnswers] = useState<FillerAnswers>({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  /** Checks the answers, sends them, and shows the thanks or the reason it failed. */
  async function submit(event: SyntheticEvent) {
    event.preventDefault()
    // A preview sends nothing.
    if (preview) return
    // The same rules the database applies, so a mistake is explained at once.
    const found = problem(answers)
    if (found !== null) {
      setError(found)
      return
    }
    setSending(true)
    setError(null)
    try {
      await onSubmit(answers)
      setSent(true)
    } catch (error_) {
      // The services' messages are written for people; anything else gets a plain line.
      setError(error_ instanceof Error ? error_.message : 'We could not send that. Try again.')
    } finally {
      setSending(false)
    }
  }

  /** Starts a fresh form, for a second response. */
  function another() {
    setAnswers({})
    setError(null)
    setSent(false)
  }

  // After a send: thanks and a way to answer again.
  if (sent) {
    return (
      <div className="grid gap-4">
        <FormMessage tone="success">Thank you. Your response was sent.</FormMessage>
        <div>
          <Button type="button" variant="outline" onClick={another}>
            Submit another response
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-5" noValidate>
      {preview && (
        <FormMessage tone="success">This is a preview. Nothing you enter is sent.</FormMessage>
      )}
      {form.questions.map((question) => (
        <Field
          key={question.id}
          question={question}
          lecturers={form.lecturers}
          value={answers[question.id]}
          onChange={(value) => {
            setAnswers((current) => {
              // Clearing an answer drops its key, so an empty choice is not sent.
              const kept = Object.entries(current).filter(([id]) => id !== question.id)
              return Object.fromEntries(
                value === undefined ? kept : [...kept, [question.id, value]],
              )
            })
          }}
        />
      ))}
      {error !== null && <FormMessage tone="error">{error}</FormMessage>}
      <div>
        <Button type="submit" disabled={sending || preview}>
          {sending ? 'Sending…' : 'Submit'}
        </Button>
      </div>
    </form>
  )
}
