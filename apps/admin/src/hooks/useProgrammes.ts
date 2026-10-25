/**
 * The Programmes screens' data (D105): the list, opening and closing enrolment, and the
 * timetable import. An import adds courses and classes as well, so it refreshes those lists and
 * the dashboard counts too.
 */

// Server state, mutations and the cache.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// What the import receives.
import type { ImportPayload } from '@/lib/timetable/payload'
// The services.
import { useServices } from '@/services/useServices'

// Query keys.
import { queryKeys } from './queryKeys'

/** Every programme with its counts. */
export function useProgrammes() {
  // The programme service.
  const { programmes } = useServices()
  return useQuery({
    queryKey: queryKeys.programmes.list(),
    queryFn: () => appQuery(() => programmes.listProgrammes()),
  })
}

/** Opens or closes a programme to students joining it themselves. */
export function useSetEnrolmentOpen() {
  // The programme service, and the cache to refresh.
  const { programmes } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ programmeId, open }: { programmeId: string; open: boolean }) =>
      appQuery(() => programmes.setEnrolmentOpen(programmeId, open)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.programmes.all }),
  })
}

/** Previews an import without saving it. Nothing changes, so nothing is refreshed. */
export function usePreviewTimetable() {
  // The programme service.
  const { programmes } = useServices()
  return useMutation({
    mutationFn: (payload: ImportPayload) =>
      appQuery(() => programmes.importTimetable(payload, { dryRun: true })),
  })
}

/** Imports a timetable for real, then refreshes everything it adds to. */
export function useImportTimetable() {
  // The programme service, and the cache to refresh.
  const { programmes } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ImportPayload) =>
      appQuery(() => programmes.importTimetable(payload, { dryRun: false })),
    onSuccess: async () => {
      // Programmes, courses, classes and the dashboard's counts all change.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.programmes.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.courses.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.classes.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ])
    },
  })
}

/** The requests to join a programme that wait for a decision. */
export function useProgrammeRequests() {
  // The programme service.
  const { programmes } = useServices()
  return useQuery({
    queryKey: queryKeys.programmes.requests(),
    queryFn: () => appQuery(() => programmes.listProgrammeRequests()),
  })
}

/** What happens once a decision is answered, whichever way it went. */
interface DecideCallbacks {
  // The request was decided.
  onDecided: (decision: 'approved' | 'declined') => void
  // The decision was refused or failed.
  onRefused: (error: unknown) => void
}

/**
 * Approves or declines a request. Approving enrols the student in the programme's courses, so the
 * course and user counts and the dashboard are refreshed along with the programmes.
 *
 * The callbacks belong to the hook, not to each `mutate` call: a decided request leaves the list,
 * so the row that made the call unmounts while the list reloads, and TanStack Query drops the
 * callbacks of a call whose component is gone. Hook-level callbacks always run, and run when the
 * answer arrives, before the reload.
 */
export function useDecideProgrammeRequest({ onDecided, onRefused }: DecideCallbacks) {
  // The programme service, and the cache to refresh.
  const { programmes } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      requestId,
      decision,
    }: {
      requestId: string
      decision: 'approved' | 'declined'
    }) => appQuery(() => programmes.decideProgrammeRequest(requestId, decision)),
    onSuccess: (_result, { decision }) => {
      onDecided(decision)
    },
    onError: (error) => {
      onRefused(error)
    },
    onSettled: () => queryClient.invalidateQueries(),
  })
}

/** The students in one programme; nothing is read until a programme is chosen. */
export function useProgrammeMembers(programmeId: string | null) {
  // The programme service.
  const { programmes } = useServices()
  return useQuery({
    queryKey: queryKeys.programmes.members(programmeId ?? ''),
    queryFn: () => appQuery(() => programmes.listProgrammeMembers(programmeId ?? '')),
    enabled: programmeId !== null,
  })
}

/** Takes a student out of their programme and its courses, then refreshes what that changes. */
export function useRemoveFromProgramme() {
  // The programme service, and the cache to refresh.
  const { programmes } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (studentId: string) => appQuery(() => programmes.removeFromProgramme(studentId)),
    onSettled: () => queryClient.invalidateQueries(),
  })
}
