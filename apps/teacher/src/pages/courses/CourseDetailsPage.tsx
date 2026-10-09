/**
 * One course (teacher REQUIREMENTS section 7): its header and its classes with their summary
 * stages. A course that isn't the teacher's answers "not found".
 */

// Icon for the back link.
import { ArrowLeft } from 'lucide-react'
// The address's parameter, and links.
import { Link, useParams } from 'react-router'

// The shared error type.
import { AppError } from '@conote/core/errors'
// Tab title and loading blocks.
import { PageTitle } from '@conote/ui/common/PageTitle'
import { Skeleton } from '@conote/ui/skeleton'

// Panels for the failure states.
import { ErrorState } from '@/components/common/ErrorState'
import { NotFoundPanel } from '@/components/common/NotFoundPanel'
// The status label.
import { CourseStatusBadge } from '@/components/courses/CourseStatusBadge'
// The classes.
import { CourseClassList } from '@/features/courses/CourseClassList'
// The course.
import { useMyCourse } from '@/hooks/useTeaching'
// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

/** One course. */
export function CourseDetailsPage() {
  // Which course the address names.
  const { courseId = '' } = useParams()
  // Its details.
  const { data, error, isPending, refetch } = useMyCourse(courseId)

  // A course that doesn't exist, or isn't this teacher's: the same answer for both.
  if (error instanceof AppError && error.kind === 'not_found') {
    return (
      <NotFoundPanel
        title="Course not found"
        backTo={TEACHER_ROUTES.courses}
        backLabel="Back to My courses"
      />
    )
  }
  // Any other failure: a fixed message and a retry.
  if (error) return <ErrorState thing="this course" onRetry={() => void refetch()} />
  // First load: blocks where the header and rows will be, announced once.
  if (isPending) {
    return (
      <output aria-label="Loading the course" className="block space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </output>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title={`${data.code} ${data.title}`} />
      {/* The way back. */}
      <Link
        to={TEACHER_ROUTES.courses}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        My courses
      </Link>
      {/* Header: code and title, with the status. */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">
          {data.code} {data.title}
        </h1>
        <CourseStatusBadge status={data.status} />
      </div>
      {/* The classes. */}
      <section aria-labelledby="classes-heading" className="space-y-3">
        <h2 id="classes-heading" className="text-lg font-semibold">
          Classes
        </h2>
        <CourseClassList classes={data.classes} />
      </section>
    </div>
  )
}
