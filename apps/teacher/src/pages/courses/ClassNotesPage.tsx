/**
 * One class's notes (D123): how many students wrote, who has not, and every note with its author.
 * The class must be one of the signed-in teacher's; any other answers "not found".
 */

// Icon for the back link.
import { ArrowLeft } from 'lucide-react'
// The address's parameters, and links.
import { Link, useParams } from 'react-router'

// The shared error type.
import { AppError } from '@conote/core/errors'
// Tab title and loading blocks.
import { PageTitle } from '@conote/ui/common/PageTitle'
import { Skeleton } from '@conote/ui/skeleton'

// Panels for the failure states, and the notes screen both staff portals share.
import { ErrorState, NotFoundPage } from '@conote/portal'
import { NotesExplorer } from '@conote/portal/notes'
// The course.
import { useMyCourse } from '@/hooks/useTeaching'
// Route constants.
import { TEACHER_ROUTES, routeTo } from '@/lib/routes'
// The services.
import { useServices } from '@/services/useServices'

/** One class's notes. */
export function ClassNotesPage() {
  // Which course and class the address names.
  const { courseId = '', classId = '' } = useParams()
  // The course, for the class's title and to prove the class is the teacher's.
  const { data, error, isPending, refetch } = useMyCourse(courseId)
  // The note reading service.
  const { notes } = useServices()

  // A course that is not the teacher's, or does not exist: the same answer for both.
  const cls = data?.classes.find((candidate) => candidate.id === classId)
  if ((error instanceof AppError && error.kind === 'not_found') || (data && !cls)) {
    return (
      <NotFoundPage
        title="Class not found"
        message="We couldn't find that."
        homePath={TEACHER_ROUTES.courses}
        homeLabel="Back to My courses"
      />
    )
  }
  // Any other failure: a fixed message and a retry.
  if (error) return <ErrorState thing="this class" onRetry={() => void refetch()} />
  // First load: blocks where the header and notes will be, announced once.
  if (isPending || !cls) {
    return (
      <output aria-label="Loading the class" className="block space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </output>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title={`Notes: ${data.code} class ${String(cls.number)}`} />
      {/* The way back. */}
      <Link
        to={routeTo.course(courseId)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {data.code} {data.title}
      </Link>
      {/* Header, and who can read these. */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          Class {cls.number}: {cls.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          What students wrote for this class, with their names. Only you and the school’s
          administrators can read these, and each time you open them is recorded.
        </p>
      </div>
      {/* The counts, who has not written, and the notes. */}
      <NotesExplorer key={classId} service={notes} courseId={courseId} classId={classId} />
    </div>
  )
}
