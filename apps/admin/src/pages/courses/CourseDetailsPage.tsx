/**
 * One course (admin REQUIREMENTS section 12): Overview, Students, Classes and Resources tabs,
 * with edit, archive and restore. An archived course shows a notice and offers no other changes.
 */

// The back arrow.
import { ArrowLeft } from 'lucide-react'
// Client-side links and the ID in the address.
import { Link, useParams } from 'react-router'

// Buttons, the tab title, loading blocks and tabs.
import { Button } from '@conote/ui/button'
import { PageTitle } from '@conote/ui/common/PageTitle'
import { Skeleton } from '@conote/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@conote/ui/tabs'

// Load-failure panel and the status label.
import { ErrorState } from '@conote/portal'
import { CourseStatusBadge } from '@/components/courses/CourseStatusBadge'
// The tabs and the actions shared with the list.
import { CourseClassesTab } from '@/features/courses/CourseClassesTab'
import { CourseOverview } from '@/features/courses/CourseOverview'
import { CourseResourcesTab } from '@/features/courses/CourseResourcesTab'
import { CourseStudents } from '@/features/courses/CourseStudents'
import { useCourseActions } from '@/features/courses/useCourseActions'
// The details.
import { useCourse } from '@/hooks/useCourses'
// Addresses.
import { ADMIN_ROUTES } from '@/lib/routes'
// The details shape.
import type { CourseDetails } from '@/types/courses'

/** The link back to the list. */
function BackLink() {
  return (
    <Link
      to={ADMIN_ROUTES.courses}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to Courses
    </Link>
  )
}

/** The loaded page. */
function Details({ course }: Readonly<{ course: CourseDetails }>) {
  // What can be done to this course.
  const actions = useCourseActions(course)

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title={course.code} />
      <BackLink />
      {/* Name, status and the actions. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{`${course.code} · ${course.title}`}</h1>
          <CourseStatusBadge status={course.status} archivedAt={course.archivedAt} />
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.isArchived ? (
            <Button type="button" onClick={actions.restore}>
              Restore
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={actions.edit}>
                Edit
              </Button>
              <Button type="button" variant="outline" onClick={actions.askArchive}>
                Archive
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Why nothing can be changed. */}
      {actions.isArchived && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
          This course is archived. Restore it to make changes.
        </p>
      )}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>
        {/* Only the selected tab is rendered. */}
        <TabsContent value="overview">
          <CourseOverview course={course} />
        </TabsContent>
        <TabsContent value="students">
          <CourseStudents courseId={course.id} code={course.code} locked={actions.isArchived} />
        </TabsContent>
        <TabsContent value="classes">
          <CourseClassesTab classes={course.classes} />
        </TabsContent>
        <TabsContent value="resources">
          <CourseResourcesTab resources={course.resources} />
        </TabsContent>
      </Tabs>
      {/* The confirmation and edit form the actions open. */}
      {actions.dialogs}
    </div>
  )
}

/** Course details. */
export function CourseDetailsPage() {
  // The course's ID from the address, and its details.
  const { courseId = '' } = useParams()
  const { data, isPending, error, refetch } = useCourse(courseId)

  // Loaded.
  if (data) return <Details course={data} />
  // Loading: the shape of the page.
  if (isPending) {
    return (
      <output aria-label="Loading course" className="block space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </output>
    )
  }
  // No such course: its own message and the way back.
  if (error.kind === 'not_found') {
    return (
      <div className="space-y-4">
        <PageTitle title="Course not found" />
        <h1 className="text-2xl font-bold">Course not found</h1>
        <p className="text-sm text-muted-foreground">
          This course doesn't exist. It may have been removed, or the link is wrong.
        </p>
        <BackLink />
      </div>
    )
  }
  // Failed: the message and a retry.
  return <ErrorState thing="this course" onRetry={() => void refetch()} />
}
