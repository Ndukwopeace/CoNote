/**
 * The teacher's courses, with loading, empty and error states (teacher REQUIREMENTS sections 6
 * and 11).
 */

// Icon for the empty state.
import { BookOpen } from 'lucide-react'

// Empty state and loading blocks.
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel.
import { ErrorState } from '@conote/portal'
// The courses.
import { useMyCourses } from '@/hooks/useTeaching'

// One course.
import { CourseCard } from './CourseCard'

/** The list, or the state in its place. */
export function CourseList() {
  // The signed-in teacher's courses.
  const { data, isPending, isError, refetch } = useMyCourses()

  // Failed: the message and a retry.
  if (isError) return <ErrorState thing="your courses" onRetry={() => void refetch()} />
  // First load: blocks where the cards will be, announced once.
  if (isPending) {
    return (
      <output aria-label="Loading your courses" className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </output>
    )
  }
  // Nothing assigned yet.
  if (data.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="You aren't teaching any courses yet.">
        An administrator assigns courses.
      </EmptyState>
    )
  }
  // The cards.
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {data.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </ul>
  )
}
