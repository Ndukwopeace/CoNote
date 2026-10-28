/**
 * The My Courses search and "Ongoing" filter (REQUIREMENTS.md FR-CRS-2, D120).
 */

// Course shapes.
import type { Course } from '@/types/domain'

/**
 * The filter's options: every course, or only those with a class going on now. There is no
 * "Upcoming" or "Completed" (D120): a status that is not about this moment goes out of date.
 */
export type CourseStatusFilter = 'all' | 'ongoing'

/** Every value the filter accepts, in display order. */
export const COURSE_STATUS_FILTERS: readonly CourseStatusFilter[] = ['all', 'ongoing']

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
      // Status first: "all" keeps everything, "ongoing" keeps the courses in session.
      (status === 'all' || course.inSession) &&
      // Then the text, in any of the three fields; an empty search matches all.
      (needle === '' ||
        [course.code, course.title, course.teacher.fullName].some((field) =>
          field.toLowerCase().includes(needle),
        )),
  )
}
