/**
 * Data hooks for class sessions (FR-CLS).
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

/** One course's classes, in number order. */
export function useCourseClasses(courseId: ID) {
  // The class service.
  const { classes } = useServices()
  // Cached list.
  return useQuery({
    queryKey: queryKeys.classes.byCourse(courseId),
    queryFn: () => appQuery(() => classes.listClasses(courseId)),
  })
}

/** Every class across the student's courses, soonest first. */
export function useMyClasses() {
  // The class service.
  const { classes } = useServices()
  // Cached list.
  return useQuery({
    queryKey: queryKeys.classes.mine(),
    queryFn: () => appQuery(() => classes.listMyClasses()),
  })
}

/** One class; fails with a not_found AppError for an unknown ID. */
export function useClass(classId: ID) {
  // The class service.
  const { classes } = useServices()
  // Cached class.
  return useQuery({
    queryKey: queryKeys.classes.detail(classId),
    queryFn: () => appQuery(() => classes.getClass(classId)),
  })
}
