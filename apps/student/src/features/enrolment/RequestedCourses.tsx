/**
 * "Requested courses" on My Courses (FR-ENR-4): the requests still waiting for an admin, and the
 * ones that were declined, so a student is never left guessing.
 */

// The status label.
import { Badge } from '@conote/ui/badge'

// Data hook.
import { useMyJoinRequests } from '@/hooks/useEnrolment'
// Date wording.
import { formatRelativeTime } from '@/lib/dates'

/** The section, or nothing when there are no requests or they haven't loaded. */
export function RequestedCourses() {
  // The student's pending and declined requests.
  const requests = useMyJoinRequests()
  // Failed or loading: this section is secondary, so it stays out of the way.
  if (!requests.data || requests.data.length === 0) return null

  return (
    <section aria-labelledby="requested-heading" className="space-y-2">
      <h2 id="requested-heading" className="text-lg font-semibold">
        Requested courses
      </h2>
      <ul className="space-y-2">
        {requests.data.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3"
          >
            {/* Which course, and when it was asked for. */}
            <div className="min-w-0">
              <p className="font-medium">
                {request.courseCode} · {request.courseTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                Requested · {formatRelativeTime(request.createdAt, new Date())}
              </p>
            </div>
            {/* Where it stands. */}
            {request.status === 'pending' ? (
              <Badge variant="warning">Waiting for approval</Badge>
            ) : (
              <Badge variant="destructive">Declined</Badge>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
