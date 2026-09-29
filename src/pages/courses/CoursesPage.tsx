/**
 * My Courses, at /courses (FR-CRS-1, FR-CRS-2). Search and status filter live in the address
 * (?q= and ?status=), so a refresh or a shared link keeps them.
 */

// Icons: search glass for the box and the no-match state, cap for "no courses".
import { GraduationCap, Search, SearchX } from 'lucide-react'
// Reads and writes the address's query string.
import { useSearchParams } from 'react-router'

// One course card.
import { CourseCard } from '@/components/common/CourseCard'
// Empty states.
import { EmptyState } from '@/components/common/EmptyState'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Tab title.
import { PageTitle } from '@/components/common/PageTitle'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// Standard button and input.
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// Enrolled courses.
import { useMyCourses } from '@/hooks/useCourses'
// Filter rules.
import {
  COURSE_STATUS_FILTERS,
  filterCourses,
  parseCourseStatusFilter,
  type CourseStatusFilter,
} from '@/lib/courses'
// Link builder.
import { routeTo } from '@/lib/routes'
// Class-name helper.
import { cn } from '@/lib/utils'

/** The filter buttons' words. */
const FILTER_LABELS: Record<CourseStatusFilter, string> = {
  all: 'All',
  ongoing: 'Ongoing',
  upcoming: 'Upcoming',
  completed: 'Completed',
}

/** My Courses. */
export function CoursesPage() {
  // The enrolled courses.
  const courses = useMyCourses()
  // The address's query string.
  const [params, setParams] = useSearchParams()
  // Search text; shown back in the box, so it is only ever text in an input, never markup.
  const query = params.get('q') ?? ''
  // SECURITY: unknown ?status= values become "all" (see parseCourseStatusFilter).
  const status = parseCourseStatusFilter(params.get('status'))

  /** Sets or removes one query parameter, replacing the history entry so Back leaves the page. */
  function setParam(name: 'q' | 'status', value: string) {
    setParams(
      (current) => {
        // Copy, so the current object isn't changed in place.
        const next = new URLSearchParams(current)
        // Defaults are left out, keeping the address short.
        if (value === '' || (name === 'status' && value === 'all')) next.delete(name)
        else next.set(name, value)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Tab title. */}
      <PageTitle title="My Courses" />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">My Courses</h1>

      {/* Search and filter; stacked on phones, one row from tablets up. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* The search box, with a decorative icon inside. */}
        <div className="relative md:w-80">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search courses"
            placeholder="Code, title or teacher"
            value={query}
            onChange={(event) => {
              setParam('q', event.target.value)
            }}
            className="pl-9"
          />
        </div>
        {/* Status filter: toggle buttons, the pressed one is filled (not colour alone: aria-pressed
            and a bolder weight). A fieldset groups them natively; its legend names the group. */}
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Filter by status</legend>
          {COURSE_STATUS_FILTERS.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={option === status ? 'default' : 'outline'}
              aria-pressed={option === status}
              className={cn(option === status && 'font-semibold')}
              onClick={() => {
                setParam('status', option)
              }}
            >
              {FILTER_LABELS[option]}
            </Button>
          ))}
        </fieldset>
      </div>

      {/* The list, or its loading, error and empty states. */}
      <CourseList
        courses={courses}
        query={query}
        status={status}
        onClear={() => {
          // Drop both parameters at once.
          setParams({}, { replace: true })
        }}
      />
    </div>
  )
}

/** The course cards under the search, with every state. */
function CourseList({
  courses,
  query,
  status,
  onClear,
}: Readonly<{
  courses: ReturnType<typeof useMyCourses>
  query: string
  status: CourseStatusFilter
  onClear: () => void
}>) {
  // Failed: message and retry.
  if (courses.isError)
    return <LoadError error={courses.error} onRetry={() => void courses.refetch()} />
  // Loading: card-shaped rows.
  if (!courses.data) return <ListSkeleton rows={4} />
  // Not enrolled in anything (FR-DSH-6 wording).
  if (courses.data.length === 0) {
    return (
      <EmptyState icon={GraduationCap} title="No courses yet">
        You&apos;re not enrolled in any courses yet. Your teacher or administrator will add you.
      </EmptyState>
    )
  }

  // The courses left after the search and filter.
  const visible = filterCourses(courses.data, { query, status })
  // Nothing matches: say so and offer the way out.
  if (visible.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No courses match"
        action={
          <Button type="button" variant="outline" onClick={onClear}>
            Clear search and filter
          </Button>
        }
      >
        Try a different search or status.
      </EmptyState>
    )
  }

  return (
    // One column on phones, two from tablets up.
    <ul className="grid gap-3 md:grid-cols-2">
      {visible.map((course) => (
        <li key={course.id}>
          <CourseCard course={course} to={routeTo.course(course.id)} />
        </li>
      ))}
    </ul>
  )
}
