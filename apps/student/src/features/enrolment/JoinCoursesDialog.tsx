/**
 * The "Join your courses" dialog (FR-ENR-1 to FR-ENR-3, FR-ENR-7): search the courses in use and
 * ask to join. Joining needs an admin's approval, so nothing here enrols the student.
 */

// Local state.
import { useState } from 'react'

// Buttons, badge, search box, dialog parts, loading blocks.
import { Badge } from '@conote/ui/badge'
import { Button } from '@conote/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@conote/ui/dialog'
import { Input } from '@conote/ui/input'
import { Skeleton } from '@conote/ui/skeleton'
// Empty state and the inline message.
import { EmptyState } from '@conote/ui/common/EmptyState'
import { FormMessage } from '@conote/ui/forms/FormMessage'
// Icon for the empty state.
import { SearchX } from 'lucide-react'

// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Data hooks.
import { useCancelJoinRequest, useJoinableCourses, useRequestToJoin } from '@/hooks/useEnrolment'
// Words for a refused request.
import { joinMessage } from './joinMessage'
// Shapes.
import type { JoinableCourse } from '@/types/domain'

/** What the dialog needs. */
interface JoinCoursesDialogProps {
  // Whether it is showing.
  open: boolean
  // Called with false when it closes (Not now, the corner button, Escape or a click outside).
  onOpenChange: (open: boolean) => void
}

/** The dialog. */
export function JoinCoursesDialog({ open, onOpenChange }: Readonly<JoinCoursesDialogProps>) {
  // The search text.
  const [query, setQuery] = useState('')
  // The last refused request's message, or null.
  const [problem, setProblem] = useState<string | null>(null)
  // The courses, and the two changes.
  const courses = useJoinableCourses(query)
  const request = useRequestToJoin()
  const cancel = useCancelJoinRequest()
  // True while either change runs, so a button can't be pressed twice.
  const busy = request.isPending || cancel.isPending

  /** Asks to join `courseId`; a refusal shows as a message. */
  function ask(courseId: string) {
    setProblem(null)
    request.mutate(courseId, {
      onError: (error) => {
        setProblem(joinMessage(error))
      },
    })
  }

  /** Withdraws the request `requestId`. */
  function withdraw(requestId: string) {
    setProblem(null)
    cancel.mutate(requestId, {
      onError: (error) => {
        setProblem(joinMessage(error))
      },
    })
  }

  /** The list, or the state in its place. */
  function body() {
    // First load failed: the message and a retry.
    if (courses.isError) {
      return <LoadError error={courses.error} onRetry={() => void courses.refetch()} />
    }
    // First load: rows of blocks, announced once.
    if (courses.isPending) {
      return (
        <output aria-label="Loading courses" className="block space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </output>
      )
    }
    // Nothing matches the search.
    if (courses.data.length === 0) {
      return <EmptyState icon={SearchX} title="No courses match your search." />
    }
    return (
      <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {courses.data.map((course) => (
          <CourseRow
            key={course.id}
            course={course}
            busy={busy}
            onAsk={() => {
              ask(course.id)
            }}
            onCancel={(requestId) => {
              withdraw(requestId)
            }}
          />
        ))}
      </ul>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {/* The title names the dialog. */}
        <DialogTitle>Join your courses</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Search for your courses and ask to join. An administrator approves each request.
        </DialogDescription>
        {/* Search by code or title. */}
        <Input
          type="search"
          aria-label="Search courses to join"
          placeholder="Code or title"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
        />
        {/* A refused request. */}
        {problem && <FormMessage tone="error">{problem}</FormMessage>}
        {/* The courses. */}
        {body()}
        {/* Leave without asking, or when done. */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** One course in the list, with the action its standing allows (FR-ENR-3). */
function CourseRow({
  course,
  busy,
  onAsk,
  onCancel,
}: Readonly<{
  course: JoinableCourse
  busy: boolean
  onAsk: () => void
  onCancel: (requestId: string) => void
}>) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
      {/* Code, title and teacher. */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary-dark">{course.code}</p>
        <p className="truncate font-medium">{course.title}</p>
        <p className="truncate text-xs text-muted-foreground">{course.teacherName}</p>
      </div>
      {/* The standing and its action. The words carry the meaning, not colour. */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {course.membership === 'enrolled' && <Badge variant="success">Joined</Badge>}
        {course.membership === 'pending' && (
          <>
            <Badge variant="warning">Requested</Badge>
            <Button
              type="button"
              variant="link"
              disabled={busy}
              aria-label={`Cancel request for ${course.code}`}
              onClick={() => {
                if (course.requestId !== null) onCancel(course.requestId)
              }}
            >
              Cancel request
            </Button>
          </>
        )}
        {course.membership === 'declined' && <Badge variant="destructive">Declined</Badge>}
        {(course.membership === 'none' || course.membership === 'declined') && (
          <Button
            type="button"
            disabled={busy}
            aria-label={`${course.membership === 'declined' ? 'Request again to join' : 'Request to join'} ${course.code}`}
            onClick={onAsk}
          >
            {course.membership === 'declined' ? 'Request again' : 'Request to join'}
          </Button>
        )}
      </div>
    </li>
  )
}
