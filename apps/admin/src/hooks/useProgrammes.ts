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
