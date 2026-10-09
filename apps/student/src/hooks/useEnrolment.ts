/**
 * Data hooks for joining courses (FR-ENR): the courses a student could join, their requests, and
 * making and withdrawing a request.
 */

// Cached reads and changes, and keeping the old list while a new search loads.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Error conversion for query functions.
import { appQuery } from '@conote/core/appQuery'
// The injected services.
import { useServices } from '@/services/useServices'

// Cache keys.
import { queryKeys } from './queryKeys'

/** Courses in use that match `query`, with the student's standing in each. */
export function useJoinableCourses(query: string) {
  // The enrolment service.
  const { enrolment } = useServices()
  return useQuery({
    queryKey: queryKeys.enrolment.joinable(query),
    queryFn: () => appQuery(() => enrolment.listJoinableCourses(query)),
    // The list stays on screen while the next search loads, so typing doesn't flash.
    placeholderData: keepPreviousData,
  })
}

/** The student's pending and declined requests, newest first. */
export function useMyJoinRequests() {
  // The enrolment service.
  const { enrolment } = useServices()
  return useQuery({
    queryKey: queryKeys.enrolment.requests(),
    queryFn: () => appQuery(() => enrolment.listMyJoinRequests()),
  })
}

/** Asks to join a course. Every enrolment list is refreshed afterwards. */
export function useRequestToJoin() {
  // The enrolment service and the cache.
  const { enrolment } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (courseId: string) => appQuery(() => enrolment.requestToJoin(courseId)),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.enrolment.all }),
  })
}

/** Withdraws a pending request. Every enrolment list is refreshed afterwards. */
export function useCancelJoinRequest() {
  // The enrolment service and the cache.
  const { enrolment } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => appQuery(() => enrolment.cancelJoinRequest(requestId)),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.enrolment.all }),
  })
}
