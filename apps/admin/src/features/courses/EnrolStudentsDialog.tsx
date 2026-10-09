/**
 * Bulk enrolment (admin REQUIREMENTS section 12): paste emails or student numbers, or read them
 * from a .csv file; preview who matches; then enrol only the valid rows.
 */

// The text, the preview and the messages.
import { useState, type ChangeEvent } from 'react'

// Buttons, fields, messages and the toast.
import { Button } from '@conote/ui/button'
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'
import { Input } from '@conote/ui/input'
import { Textarea } from '@conote/ui/textarea'
import { useToast } from '@conote/ui/toast'

// The dialog around the form.
import { FormDialog } from '@/components/common/FormDialog'
// The preview and the enrolment.
import { useEnrollStudents, useMatchStudents } from '@/hooks/useCourses'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Reading the pasted text.
import { MAX_IDENTIFIERS, parseIdentifiers } from '@/lib/identifiers'
// Preview shapes.
import type { EnrollmentMatch, UnmatchedReason } from '@/types/courses'

/** The biggest file read. SECURITY: a huge file is turned away before it is read into memory. */
const MAX_FILE_BYTES = 200_000

/** Why a row didn't match, in words. */
const REASONS: Record<UnmatchedReason, string> = {
  not_found: 'No account found',
  not_a_student: 'Not a student',
  not_active: 'Not active',
}

/** Which course, and whether the dialog is open. */
interface EnrolStudentsDialogProps {
  courseId: string
  code: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** "1 student" or "2 students". */
function students(count: number) {
  return `${String(count)} ${count === 1 ? 'student' : 'students'}`
}

/** The preview: who will be enrolled, who already is, and what didn't match. */
function Preview({ match }: Readonly<{ match: EnrollmentMatch }>) {
  return (
    <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
      <section>
        <h3 className="font-medium">Will be enrolled ({match.matched.length})</h3>
        <ul className="text-muted-foreground">
          {match.matched.map((student) => (
            <li key={student.id}>{student.fullName}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-medium">Already enrolled ({match.alreadyEnrolled.length})</h3>
        <ul className="text-muted-foreground">
          {match.alreadyEnrolled.map((student) => (
            <li key={student.id}>{student.fullName}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-medium">Not matched ({match.unmatched.length})</h3>
        <ul className="text-muted-foreground">
          {match.unmatched.map((row) => (
            <li key={row.value}>
              {row.value} — {REASONS[row.reason]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** The form. */
function EnrolForm({
  courseId,
  code,
  onDone,
}: Readonly<{ courseId: string; code: string; onDone: () => void }>) {
  // The two calls and the toast.
  const match = useMatchStudents()
  const enrol = useEnrollStudents()
  const toast = useToast()
  // The pasted text, the preview, and a message about the text or file.
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<EnrollmentMatch | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  /** Changes the text; an old preview no longer matches it. */
  function edit(next: string) {
    setText(next)
    setPreview(null)
    setProblem(null)
  }

  /** Adds a chosen file's text to the box. */
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    // SECURITY: refuse a big file before reading it.
    if (file.size > MAX_FILE_BYTES) {
      setProblem('That file is too large. Use a file under 200 KB.')
    } else {
      edit(text ? `${text}\n${await file.text()}` : await file.text())
    }
    // Allow choosing the same file again.
    input.value = ''
  }

  /** Previews the matches. */
  function runPreview() {
    const identifiers = parseIdentifiers(text)
    if (identifiers.length === 0) {
      setProblem('Enter at least one email or student number.')
      return
    }
    match.mutate({ courseId, identifiers }, { onSuccess: setPreview })
  }

  /** Enrols the matched students and closes. */
  function apply() {
    if (!preview) return
    enrol.mutate(
      { courseId, studentIds: preview.matched.map((student) => student.id) },
      {
        onSuccess: ({ added }) => {
          toast.success(`Enrolled ${students(added)}.`)
          onDone()
        },
      },
    )
  }

  // How many values the text holds, to say when the cap cut some off.
  const capped = parseIdentifiers(text).length >= MAX_IDENTIFIERS
  const error = problem ?? (match.error ? errorMessage(match.error) : null)

  return (
    <div className="space-y-4">
      {/* A message about the text or file, or a failed call. */}
      {(error ?? enrol.error) && (
        <FormMessage tone="error">
          {error ?? (enrol.error ? errorMessage(enrol.error) : '')}
        </FormMessage>
      )}
      <FormField id="enrol-text" label="Emails or student numbers">
        {(field) => (
          <Textarea
            {...field}
            rows={5}
            placeholder="One per line, or separated by commas"
            value={text}
            onChange={(event) => {
              edit(event.target.value)
            }}
          />
        )}
      </FormField>
      <FormField id="enrol-file" label="Or upload a .csv file">
        {(field) => (
          <Input
            {...field}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(event) => void readFile(event)}
          />
        )}
      </FormField>
      {capped && (
        <p className="text-sm text-muted-foreground">
          Only the first {MAX_IDENTIFIERS} values are read.
        </p>
      )}
      {/* Nothing is enrolled until the preview has been checked and confirmed. */}
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={match.isPending} onClick={runPreview}>
          {match.isPending ? 'Checking…' : 'Preview'}
        </Button>
      </div>
      {preview && (
        <>
          <Preview match={preview} />
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={preview.matched.length === 0 || enrol.isPending}
              onClick={apply}
            >
              {enrol.isPending ? 'Enrolling…' : `Enrol ${students(preview.matched.length)}`}
            </Button>
          </div>
        </>
      )}
      <p className="sr-only">{`Enrolling in ${code}`}</p>
    </div>
  )
}

/** The enrol dialog. */
export function EnrolStudentsDialog({
  courseId,
  code,
  open,
  onOpenChange,
}: Readonly<EnrolStudentsDialogProps>) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enrol students"
      description={`Add students to ${code}. You’ll see who matches before anything changes.`}
    >
      {/* A fresh form each time it opens. */}
      {open && (
        <EnrolForm
          courseId={courseId}
          code={code}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      )}
    </FormDialog>
  )
}
