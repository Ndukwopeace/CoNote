/**
 * My courses (teacher REQUIREMENTS section 6): where signing in lands.
 */

// The tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'

// The list.
import { CourseList } from '@/features/courses/CourseList'

/** My courses. */
export function CoursesPage() {
  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="My courses" />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold">My courses</h1>
      {/* The courses. */}
      <CourseList />
    </div>
  )
}
