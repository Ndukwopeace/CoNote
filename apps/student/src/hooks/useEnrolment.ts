/**
 * Data hooks for joining courses (FR-ENR): the courses a student could join, their requests,
 * making and withdrawing a request, and the programmes (D105).
 */

// Cached reads and changes, and keeping the old list while a new search loads.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// The confirmation toast.
import { useToast } from '@conote/ui/toast'

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

/** The programmes open to join. */
export function useJoinableProgrammes() {
  // The enrolment service.
  const { enrolment } = useServices()
  return useQuery({
    queryKey: queryKeys.enrolment.programmes(),
    queryFn: () => appQuery(() => enrolment.listJoinableProgrammes()),
  })
}

/** "You joined 3 courses." */
function joinedText(added: number): string {
  if (added === 0) return "You're already in all of its courses."
  return `You joined ${added} ${added === 1 ? 'course' : 'courses'}.`
}

/**
 * Joins a programme. Joining enrols the student in several courses at once, so every cached read
 * (courses, classes, notes, summaries, the lists here) is refreshed afterwards. The toast is
 * raised here, not by the caller: the refresh turns the dialog's own screen into the student's
 * Home, and a callback of a component that has unmounted would never run.
 */
export function useJoinProgramme() {
  // The enrolment service and the cache.
  const { enrolment } = useServices()
  const client = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (programmeId: string) => appQuery(() => enrolment.joinProgramme(programmeId)),
    onSuccess: (added) => {
      toast.success(joinedText(added))
    },
    onSettled: () => client.invalidateQueries(),
  })
}
