/**
 * A form's results (D126): the averages by course and lecturer, then every answer, newest first, with a
 * filter by course and lecturer, a CSV download, and a way to delete one answer (for spam). Only
 * administrators see this page. Answers hold no names.
 */

// Icons.
import { ArrowLeft, Download, Trash2 } from 'lucide-react'
// Local state.
import { useState } from 'react'
// Links and the ID in the address.
import { Link, useParams } from 'react-router'

// The tab title, the empty panel, the dialog, buttons, drop-down and loading blocks.
import { PageTitle } from '@conote/ui/common/PageTitle'
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Button } from '@conote/ui/button'
import { NativeSelect } from '@conote/ui/native-select'
import { Skeleton } from '@conote/ui/skeleton'
// Load-failure panel.
import { ErrorState } from '@conote/portal'
// Icon for the empty state.
import { BarChart3 } from 'lucide-react'

// The pieces.
import { ResultsTable } from '@/features/forms/ResultsTable'
import { useCsvDownload } from '@/features/forms/useCsvDownload'
// The data.
import { useDeleteResponse, useForm, useFormResponses, useFormSummary } from '@/hooks/useForms'
// Dates and addresses.
import { formatDate } from '@/lib/format'
import { ADMIN_ROUTES, routeTo } from '@/lib/routes'
// The shapes.
import {
  FORM_RESPONSES_PAGE_SIZE,
  type AdminForm,
  type FormResponseFilter,
  type FormResponseItem,
} from '@/types/forms'

/** The answers, one card each. */
function ResponseCard({
  form,
  response,
  onDelete,
}: Readonly<{ form: AdminForm; response: FormResponseItem; onDelete: () => void }>) {
  // The questions that were answered, in the form's order. The lecturer question has its own line.
  const answered = form.questions.filter(
    (question) => question.kind !== 'lecturer' && response.answers[question.id] !== undefined,
  )
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {[response.courseCode, response.lecturer].filter((part) => part !== null).join(' · ') ||
            'Response'}
          <span className="ml-2 font-normal text-muted-foreground">
            {formatDate(response.createdAt)}
          </span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Delete this response"
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </div>
      <dl className="grid gap-1 text-sm">
        {answered.map((question) => (
          <div key={question.id} className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">{question.prompt}:</dt>
            {/* The answer is text, never markup, and long unbroken words wrap. */}
            <dd className="[overflow-wrap:anywhere] whitespace-pre-wrap">
              {String(response.answers[question.id])}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  )
}

/** The results page. */
export function FormResultsPage() {
  // The form's ID, from the address.
  const { formId = '' } = useParams()
  const form = useForm(formId)
  const summary = useFormSummary(formId)
  // What the answers are narrowed to: a course and lecturer chosen together, and where the page starts.
  const [choice, setChoice] = useState('')
  const [offset, setOffset] = useState(0)
  const [courseCode, lecturer] = choice === '' ? [undefined, undefined] : choice.split('\u0000')
  const filter: FormResponseFilter = { courseCode, lecturer, offset }
  const responses = useFormResponses(formId, filter)
  const remove = useDeleteResponse()
  // The answer waiting for the administrator to confirm its deletion.
  const [pending, setPending] = useState<string | null>(null)
  const csv = useCsvDownload(formId, form.data?.title ?? '', form.data?.questions ?? [], {
    courseCode,
    lecturer,
  })

  if (form.isError) {
    return form.error.kind === 'not_found' ? (
      <div className="space-y-3">
        <PageTitle title="Form not found" />
        <Link to={ADMIN_ROUTES.forms} className="text-sm text-primary underline">
          All forms
        </Link>
        <p>We could not find that form. It may have been deleted.</p>
      </div>
    ) : (
      <ErrorState thing="the form" onRetry={() => void form.refetch()} />
    )
  }
  if (form.isPending) {
    return (
      <output aria-label="Loading the results" className="block space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
      </output>
    )
  }

  const total = responses.data?.total ?? 0
  const last = Math.min(offset + FORM_RESPONSES_PAGE_SIZE, total)
  return (
    <div className="space-y-8">
      <PageTitle title={`${form.data.title}: results`} />
      <header className="space-y-3">
        <Link
          to={ADMIN_ROUTES.forms}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All forms
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{form.data.title}</h1>
            <p className="text-sm text-muted-foreground">
              {`${String(form.data.responseCount)} ${form.data.responseCount === 1 ? 'response' : 'responses'}. Only administrators can see these results, and they hold no names.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void csv.run()}
              disabled={csv.working || total === 0}
            >
              <Download aria-hidden="true" />
              {csv.working ? 'Preparing…' : 'Download CSV'}
            </Button>
            <Button asChild variant="outline">
              <Link to={routeTo.form(formId)}>Edit form</Link>
            </Button>
          </div>
        </div>
        {csv.failed && (
          <p role="alert" className="text-sm text-destructive">
            We could not prepare the file. Try again.
          </p>
        )}
      </header>

      <section aria-label="Results by course and lecturer" className="space-y-3">
        <h2 className="text-lg font-semibold">Results by course and lecturer</h2>
        {summary.isError && (
          <ErrorState thing="the results" onRetry={() => void summary.refetch()} />
        )}
        {summary.isPending && <Skeleton className="h-32" />}
        {summary.data?.length === 0 && (
          <EmptyState icon={BarChart3} title="No responses yet.">
            Share the link, and the results appear here as students answer.
          </EmptyState>
        )}
        {summary.data && summary.data.length > 0 && (
          <ResultsTable questions={form.data.questions} rows={summary.data} />
        )}
      </section>

      <section aria-label="Responses" className="space-y-3">
        <h2 className="text-lg font-semibold">Responses</h2>
        {summary.data && summary.data.length > 0 && (
          <div className="grid max-w-md gap-1 text-sm">
            <label htmlFor="response-filter" className="font-medium">
              Course and lecturer
            </label>
            <NativeSelect
              id="response-filter"
              value={choice}
              onChange={(event) => {
                setChoice(event.target.value)
                setOffset(0)
              }}
            >
              <option value="">All</option>
              {summary.data
                .filter((row) => row.courseCode !== null && row.lecturer !== null)
                .map((row) => (
                  <option
                    key={`${row.courseCode ?? ''}|${row.lecturer ?? ''}`}
                    value={`${row.courseCode ?? ''}\u0000${row.lecturer ?? ''}`}
                  >
                    {`${row.courseCode ?? ''} · ${row.lecturer ?? ''}`}
                  </option>
                ))}
            </NativeSelect>
          </div>
        )}
        {responses.isError && (
          <ErrorState thing="the responses" onRetry={() => void responses.refetch()} />
        )}
        {responses.isPending && <Skeleton className="h-24" />}
        {responses.data && responses.data.items.length > 0 && (
          <>
            <ul aria-label="Responses" className="divide-y rounded-xl border bg-card">
              {responses.data.items.map((response) => (
                <ResponseCard
                  key={response.id}
                  form={form.data}
                  response={response}
                  onDelete={() => {
                    setPending(response.id)
                  }}
                />
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p>{`Showing ${String(offset + 1)} to ${String(last)} of ${String(total)}`}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => {
                    setOffset(Math.max(offset - FORM_RESPONSES_PAGE_SIZE, 0))
                  }}
                >
                  Previous page
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={last >= total}
                  onClick={() => {
                    setOffset(offset + FORM_RESPONSES_PAGE_SIZE)
                  }}
                >
                  Next page
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        title="Delete this response?"
        description="It is removed for good and no longer counts in the results."
        confirmLabel="Delete response"
        onConfirm={() => {
          if (pending !== null) remove.mutate(pending)
          setPending(null)
        }}
      />
    </div>
  )
}
