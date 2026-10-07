/**
 * Data hooks for the student's enrolled courses (FR-CRS).
 */

// Cached, deduplicated reads.
import { useQuery } from '@tanstack/react-query'

// The injected services.
import { useServices } from '@/services/useServices'
// Identifier type.
import type { ID } from '@/types/domain'

// Error conversion for query functions.
import { appQuery } from './appQuery'
// Cache keys.
import { queryKeys } from './queryKeys'

/** Every enrolled course. */
export function useMyCourses() {
  // The course service.
  const { courses } = useServices()
  // Cached list.
  return useQuery({
    queryKey: queryKeys.courses.list(),
    queryFn: () => appQuery(() => courses.listMyCourses()),
  })
}

/** One course; fails with a not_found AppError for an unknown ID. */
export function useCourse(courseId: ID) {
  // The course service.
  const { courses } = useServices()
  // Cached course.
  return useQuery({
    queryKey: queryKeys.courses.detail(courseId),
    queryFn: () => appQuery(() => courses.getCourse(courseId)),
  })
}
