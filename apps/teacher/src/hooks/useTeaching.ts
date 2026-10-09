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
