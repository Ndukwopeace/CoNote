/**
 * The Classes screens' data (admin REQUIREMENTS section 13): the list, the details and the filter
 * choices, and the changes. Every change refreshes the class queries, the course queries (class
 * counts and tabs) and the dashboard.
 */

// Server state, mutations, the cache, and keeping the old page while the next loads.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The services.
import { useServices } from '@/services/useServices'
// Class shapes.
import type { ClassFilter, ClassInput } from '@/types/classes'

// Query keys.
import { queryKeys } from './queryKeys'

/** One page of the list. The previous page stays on screen while the next loads. */
export function useClasses(filter: ClassFilter) {
  // The class service.
  const { classes } = useServices()
  return useQuery({
    queryKey: queryKeys.classes.list(filter),
    queryFn: () => appQuery(() => classes.listClasses(filter)),
    placeholderData: keepPreviousData,
  })
}

/** The courses the filter and the form offer. */
export function useClassFilterOptions() {
  // The class service.
  const { classes } = useServices()
  return useQuery({
    queryKey: queryKeys.classes.filterOptions(),
    queryFn: () => appQuery(() => classes.listClassFilterOptions()),
  })
}

/** One class's details. An empty ID loads nothing (for a form that is creating a class). */
export function useClass(classId: string) {
  // The class service.
  const { classes } = useServices()
  return useQuery({
    queryKey: queryKeys.classes.detail(classId),
    queryFn: () => appQuery(() => classes.getClass(classId)),
    enabled: classId !== '',
  })
}

/** Clears the class, course and dashboard queries, so lists, details and counts show the change. */
function useRefreshClasses() {
  // The query cache.
  const queryClient = useQueryClient()
  return async () => {
    // All at once; the screens refetch what they show.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.classes.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    ])
  }
}

/** Creates a class. */
export function useCreateClass() {
  // The class service, and the refresh after a change.
  const { classes } = useServices()
  const refresh = useRefreshClasses()
  return useMutation({
    mutationFn: (input: ClassInput) => appQuery(() => classes.createClass(input)),
    onSuccess: refresh,
  })
}

/** Saves a class's changes. */
export function useUpdateClass() {
  // The class service, and the refresh after a change.
  const { classes } = useServices()
  const refresh = useRefreshClasses()
  return useMutation({
    mutationFn: ({ classId, input }: { classId: string; input: ClassInput }) =>
      appQuery(() => classes.updateClass(classId, input)),
    onSuccess: refresh,
  })
}

/** Archives a class. */
export function useArchiveClass() {
  // The class service, and the refresh after a change.
  const { classes } = useServices()
  const refresh = useRefreshClasses()
  return useMutation({
    mutationFn: (classId: string) => appQuery(() => classes.archiveClass(classId)),
    onSuccess: refresh,
  })
}
