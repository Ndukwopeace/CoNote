/**
 * The Requests tab (D76): students who asked to join this course, oldest first, each with
 * Approve and Decline. Approving enrols the student; declining lets them ask again.
 */

// Buttons and loading blocks.
import { Button } from '@conote/ui/button'
import { Skeleton } from '@conote/ui/skeleton'
import { useToast } from '@conote/ui/toast'

// The shared table and load-failure panel.
import { DataTable, type DataColumn } from '@/components/common/DataTable'
import { ErrorState } from '@conote/portal'
// The list and the decision.
import { useDecideEnrollmentRequest, useEnrollmentRequests } from '@/hooks/useCourses'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Date wording.
import { formatDate } from '@/lib/format'
// Request shape.
import type { EnrollmentRequest, RequestDecision } from '@/types/courses'

/** Which course, and whether it can change. */
interface CourseRequestsProps {
  courseId: string
  code: string
  // True for an archived course: nothing can be decided.
  locked: boolean
}

/** The Requests tab. */
export function CourseRequests({ courseId, code, locked }: Readonly<CourseRequestsProps>) {
  // The waiting requests, the decision and the toast.
  const { data, isPending, isError, refetch } = useEnrollmentRequests(courseId)
  const decide = useDecideEnrollmentRequest()
  const toast = useToast()

  /** Sends a decision and says what happened. */
  function send(request: EnrollmentRequest, decision: RequestDecision) {
    decide.mutate(
      { requestId: request.id, decision },
      {
        onSuccess: () => {
          toast.success(
            decision === 'approved'
              ? `${request.student.fullName} added to ${code}.`
              : `Request from ${request.student.fullName} declined.`,
          )
        },
        onError: (error) => {
          toast.error(errorMessage(error))
        },
      },
    )
  }

  // The columns.
  const columns: DataColumn<EnrollmentRequest, never>[] = [
    {
      heading: 'Name',
      cell: (request) => <span className="font-medium">{request.student.fullName}</span>,
    },
    { heading: 'Email', cell: (request) => request.student.email },
    { heading: 'Student number', cell: (request) => request.student.studentNumber ?? '—' },
    { heading: 'Asked on', cell: (request) => formatDate(request.requestedAt) },
  ]

  // Failed: the message and a retry.
  if (isError) return <ErrorState thing="requests" onRetry={() => void refetch()} />
  // First load.
  if (isPending) {
    return (
      <output aria-label="Loading requests" className="block space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-11" />
        ))}
      </output>
    )
  }
  // Nobody is waiting.
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No students are waiting to join.</p>
  }
  return (
    <DataTable
      label={`Requests to join ${code}`}
      rows={data}
      rowKey={(request) => request.id}
      columns={columns}
      actions={
        locked
          ? undefined
          : (request) => (
              <span className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={decide.isPending}
                  aria-label={`Approve ${request.student.fullName}`}
                  onClick={() => {
                    send(request, 'approved')
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={decide.isPending}
                  aria-label={`Decline ${request.student.fullName}`}
                  onClick={() => {
                    send(request, 'declined')
                  }}
                >
                  Decline
                </Button>
              </span>
            )
      }
    />
  )
}
