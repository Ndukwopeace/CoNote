/**
 * The My Courses search and status filter (REQUIREMENTS.md FR-CRS-2).
 */

// Course shapes.
import type { Course, CourseStatus } from '@/types/domain'

/** The status filter's options: every status, or all of them. */
export type CourseStatusFilter = CourseStatus | 'all'

/** Every value the filter accepts, in display order. */
export const COURSE_STATUS_FILTERS: readonly CourseStatusFilter[] = [
  'all',
  'ongoing',
  'upcoming',
  'completed',
]

/**
 * Reads the filter from the address (?status=).
 * SECURITY: only known values are accepted; anything else becomes "all", so a tampered
 * address can't feed unexpected text into the filter or onto the screen.
 */
export function parseCourseStatusFilter(value: string | null): CourseStatusFilter {
  // Exact match against the known list.
  return COURSE_STATUS_FILTERS.find((option) => option === value) ?? 'all'
}

/** Courses matching the search text (code, title or teacher) and the status filter. */
export function filterCourses(
  courses: readonly Course[],
  { query, status }: Readonly<{ query: string; status: CourseStatusFilter }>,
): Course[] {
  // Case and surrounding spaces don't matter.
  const needle = query.trim().toLowerCase()
  return courses.filter(
    (course) =>
      // Status first: "all" keeps everything.
      (status === 'all' || course.status === status) &&
      // Then the text, in any of the three fields; an empty search matches all.
      (needle === '' ||
        [course.code, course.title, course.teacher.fullName].some((field) =>
          field.toLowerCase().includes(needle),
        )),
  )
}
