/**
 * The first step of the timetable import (D105): the PDF, the first and last day of the term,
 * days without classes, and the time zone. Everything is checked here before the file is read.
 */

// The label with its inline error.
import { FormField } from '@conote/ui/forms/FormField'
// The error box.
import { FormMessage } from '@conote/ui/forms/FormMessage'
// Button and inputs.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
import { Textarea } from '@conote/ui/textarea'
// State.
import { useState, type SyntheticEvent } from 'react'

// The values and request shapes, and which field a term problem belongs to.
import { termField, type ImportFormValues, type ImportRequest } from './importFormValues'
// Checking the term and the days off.
import { parseDateList, validateTerm, type TermDates } from '@/lib/timetable/term'
// Time zone names.
import { isValidTimeZone } from '@/lib/timetable/zonedTime'

/** The biggest timetable accepted: far more than a school timetable needs. */
const MAX_BYTES = 10 * 1024 * 1024

/** What the form needs from its page. */
interface ImportFormProps {
  // The values to start with (kept when the administrator comes back from the review).
  initial: ImportFormValues
  // Whether the file is being read.
  busy: boolean
  // Why the last attempt failed, in words for the form (with details under it), or null.
  error: { message: string; details: string[] } | null
  // Called with a checked request.
  onSubmit: (request: ImportRequest, values: ImportFormValues) => void
}

/** The step. */
export function ImportForm({ initial, busy, error, onSubmit }: Readonly<ImportFormProps>) {
  // What has been typed, and what is wrong with it.
  const [values, setValues] = useState(initial)
  const [problems, setProblems] = useState<Partial<Record<keyof ImportFormValues, string>>>({})

  /** Checks the values and, if they are fine, hands them on. */
  function submit(event: SyntheticEvent) {
    event.preventDefault()
    const found: Partial<Record<keyof ImportFormValues, string>> = {}
    // The file: present, a PDF and not enormous. The type is only a hint, so the name counts too.
    if (!values.file) found.file = 'Choose the timetable PDF.'
    else if (values.file.type !== 'application/pdf' && !/\.pdf$/i.test(values.file.name)) {
      found.file = 'Choose a PDF file.'
    } else if (values.file.size > MAX_BYTES) found.file = 'This file is larger than 10 MB.'
    // The days off: each must be a date.
    const skipped = parseDateList(values.skip)
    if (skipped.invalid.length > 0) {
      found.skip = `These are not dates (use YYYY-MM-DD): ${skipped.invalid.join(', ')}`
    }
    // The term's dates, with the message the check gives.
    const term: TermDates = { start: values.start, end: values.end, skip: skipped.dates }
    const termProblem = validateTerm(term)
    if (termProblem) found[termField(termProblem)] = termProblem
    // The time zone.
    if (!isValidTimeZone(values.timezone.trim())) {
      found.timezone = "That time zone isn't one we know, for example Africa/Douala."
    }
    setProblems(found)
    if (Object.keys(found).length > 0 || !values.file) return
    onSubmit({ file: values.file, term, timezone: values.timezone.trim() }, values)
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Timetable file and dates"
      className="max-w-xl space-y-5"
    >
      {/* Why the last attempt failed. */}
      {error && (
        <FormMessage tone="error">
          <span>
            {error.message}
            {error.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </span>
        </FormMessage>
      )}
      {/* The file. */}
      <FormField id="timetable-file" label="Timetable PDF" error={problems.file}>
        {(control) => (
          <>
            <Input
              {...control}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setValues({ ...values, file: event.target.files?.[0] ?? null })
              }}
            />
            {/* The file that is chosen, kept when the administrator comes back from the review. */}
            {values.file && (
              <p className="text-sm text-muted-foreground">Selected: {values.file.name}</p>
            )}
          </>
        )}
      </FormField>
      {/* The term. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="term-start" label="First day of term" error={problems.start}>
          {(control) => (
            <Input
              {...control}
              type="date"
              value={values.start}
              onChange={(event) => {
                setValues({ ...values, start: event.target.value })
              }}
            />
          )}
        </FormField>
        <FormField id="term-end" label="Last day of term" error={problems.end}>
          {(control) => (
            <Input
              {...control}
              type="date"
              value={values.end}
              onChange={(event) => {
                setValues({ ...values, end: event.target.value })
              }}
            />
          )}
        </FormField>
      </div>
      {/* Days with no classes. */}
      <FormField id="term-skip" label="Days without classes (optional)" error={problems.skip}>
        {(control) => (
          <>
            <Textarea
              {...control}
              rows={2}
              placeholder="2026-11-02, 2026-12-01"
              value={values.skip}
              onChange={(event) => {
                setValues({ ...values, skip: event.target.value })
              }}
            />
            <p className="text-sm text-muted-foreground">
              Holidays and breaks, as YYYY-MM-DD, separated by commas or lines. No class is made on
              them.
            </p>
          </>
        )}
      </FormField>
      {/* The time zone the times are read in. */}
      <FormField id="timezone" label="Time zone" error={problems.timezone}>
        {(control) => (
          <Input
            {...control}
            value={values.timezone}
            onChange={(event) => {
              setValues({ ...values, timezone: event.target.value })
            }}
          />
        )}
      </FormField>
      <Button type="submit" disabled={busy}>
        {busy ? 'Reading…' : 'Read timetable'}
      </Button>
    </form>
  )
}
