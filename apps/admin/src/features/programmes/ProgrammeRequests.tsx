/**
 * The requests to join a programme that wait for an administrator (D106), above the programme list:
 * who asked, for which programme and when, with Approve and Decline. Approving enrols the student
 * in every course in use the programme holds. Loading, empty and error states are all handled.
 */

// Buttons, loading blocks and the toast.
import { Button } from '@conote/ui/button'
import { Skeleton } from '@conote/ui/skeleton'
import { useToast } from '@conote/ui/toast'

// The load-failure panel.
import { ErrorState } from '@conote/portal'
// The table.
import { DataTable, type DataColumn } from '@/components/common/DataTable'
// The data and the change.
import { useDecideProgrammeRequest, useProgrammeRequests } from '@/hooks/useProgrammes'
// Words for a refused change.
import { programmeMessage } from './programmeMessage'
// The console's date wording.
import { formatDate } from '@/lib/format'
// The row shape.
import type { ProgrammeRequestItem } from '@/types/programmes'

/** The columns: who asked, for what, and when. */
const COLUMNS: DataColumn<ProgrammeRequestItem, never>[] = [
  {
    heading: 'Student',
    cell: (request) => (
      <span className="min-w-0">
        <span className="block font-medium">{request.studentName}</span>
        <span className="block text-xs break-words text-muted-foreground">
          {request.studentEmail}
        </span>
      </span>
    ),
  },
  {
    heading: 'Programme',
    cell: (request) => (
      <span className="min-w-0">
        <span className="block font-medium">{request.programmeCode}</span>
        <span className="block text-xs text-muted-foreground">{request.programmeName}</span>
      </span>
    ),
  },
  { heading: 'Asked', cell: (request) => formatDate(request.createdAt) },
]

/** Approve and Decline for one request, and the toast that says what happened. */
function RequestActions({ request }: Readonly<{ request: ProgrammeRequestItem }>) {
  // The change, and the toasts that report it.
  const decide = useDecideProgrammeRequest()
  const toast = useToast()

  /** Decides the request and says so; a refusal is explained in words. */
  function run(decision: 'approved' | 'declined') {
    decide.mutate(
      { requestId: request.id, decision },
      {
        onSuccess: () => {
          toast.success(
            decision === 'approved'
              ? `${request.studentName} joined ${request.programmeCode}.`
              : `Request from ${request.studentName} declined.`,
          )
        },
        onError: (error) => {
          toast.error(programmeMessage(error))
        },
      },
    )
  }

  return (
    <span className="flex gap-2">
      <Button
        type="button"
        size="sm"
        disabled={decide.isPending}
        aria-label={`Approve ${request.studentName} for ${request.programmeCode}`}
        onClick={() => {
          run('approved')
        }}
      >
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={decide.isPending}
        aria-label={`Decline ${request.studentName} for ${request.programmeCode}`}
        onClick={() => {
          run('declined')
        }}
      >
        Decline
      </Button>
    </span>
  )
}

/** The row actions, defined once outside the component. */
function renderActions(request: ProgrammeRequestItem) {
  return <RequestActions request={request} />
}

/** The section. */
export function ProgrammeRequests() {
  // The waiting requests.
  const { data, isPending, isError, refetch } = useProgrammeRequests()

  /** The table, or the state in its place. */
  function body() {
    // Failed: the message and a retry.
    if (isError) return <ErrorState thing="requests" onRetry={() => void refetch()} />
    // First load: rows of blocks, announced once.
    if (isPending) {
      return (
        <output aria-label="Loading requests" className="block space-y-2">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </output>
      )
    }
    // Nobody waiting.
    if (data.length === 0) {
      return <p className="text-sm text-muted-foreground">No requests are waiting.</p>
    }
    return (
      <DataTable
        label="Requests to join a programme"
        rows={data}
        rowKey={(request) => request.id}
        columns={COLUMNS}
        actions={renderActions}
      />
    )
  }

  return (
    <section aria-labelledby="programme-requests-heading" className="space-y-3">
      <h2 id="programme-requests-heading" className="text-lg font-semibold">
        Requests
        {data && data.length > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {data.length} waiting
          </span>
        )}
      </h2>
      {body()}
    </section>
  )
}
