/**
 * What Home shows a student who is in no courses (FR-DSH-6, FR-ENR-1, FR-ENR-2): the empty state
 * with a way to find courses, and the "Join your courses" dialog, which opens by itself once when
 * the student has no requests either.
 */

// Icon for the no-courses state.
import { GraduationCap } from 'lucide-react'
// Client-side links.
import { Link } from 'react-router'

// Enrolment empty state.
import { EmptyState } from '@conote/ui/common/EmptyState'
// Standard button.
import { Button } from '@conote/ui/button'
// Asking to join courses (FR-ENR).
import { JoinCoursesDialog } from '@/features/enrolment/JoinCoursesDialog'
import { useJoinPrompt } from '@/features/enrolment/useJoinPrompt'
import { useMyJoinRequests } from '@/hooks/useEnrolment'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** The empty state, shown in place of the stream. */
export function NoCourses() {
  // The requests already made.
  const requests = useMyJoinRequests()
  // The dialog opens by itself once the page knows there are no requests.
  const prompt = useJoinPrompt(requests.data?.length === 0)
  // How many requests are waiting, for the line under the message.
  const waiting = requests.data?.filter((request) => request.status === 'pending').length ?? 0

  return (
    <>
      <EmptyState
        icon={GraduationCap}
        title="No courses yet"
        action={
          <Button type="button" onClick={prompt.open}>
            Join programme
          </Button>
        }
      >
        You&apos;re not enrolled in any courses yet. Join your programme to get your courses, or
        wait for your teacher or administrator to add you.
        {/* Requests already made, with the way to see them. */}
        {waiting > 0 && (
          <>
            {' '}
            {waiting === 1 ? '1 request is' : `${String(waiting)} requests are`} waiting for
            approval; see {waiting === 1 ? 'it' : 'them'} in{' '}
            <Link to={ROUTES.courses} className="font-medium text-primary-dark hover:underline">
              My Courses
            </Link>
            .
          </>
        )}
      </EmptyState>
      <JoinCoursesDialog open={prompt.isOpen} onOpenChange={prompt.onOpenChange} />
    </>
  )
}
