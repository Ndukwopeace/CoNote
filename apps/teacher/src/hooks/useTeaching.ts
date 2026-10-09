/**
 * The teacher's course data (teacher REQUIREMENTS section 6).
 */

// Server state.
import { useQuery } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The services.
import { useServices } from '@/services/useServices'

// Query keys.
import { queryKeys } from './queryKeys'

/** The signed-in teacher's courses. */
export function useMyCourses() {
  // The teaching service.
  const { teaching } = useServices()
  return useQuery({
    queryKey: queryKeys.teaching.myCourses(),
    queryFn: () => appQuery(() => teaching.listMyCourses()),
  })
}

/** One of the teacher's courses with its classes. An unknown ID is a not_found error. */
export function useMyCourse(courseId: string) {
  // The teaching service.
  const { teaching } = useServices()
  return useQuery({
    queryKey: queryKeys.teaching.course(courseId),
    queryFn: () => appQuery(() => teaching.getMyCourse(courseId)),
  })
}
