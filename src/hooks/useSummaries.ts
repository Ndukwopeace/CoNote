/**
 * Data hooks for published summaries: lists, one class's summary, and marking one as viewed.
 */

// Cached reads, the mark-as-viewed call, and the cache.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// The injected services.
import { useServices } from '@/services/useServices'
// Identifier type.
import type { ID } from '@/types/domain'

// Error conversion for query functions.
import { appQuery } from './appQuery'
// Cache keys.
import { queryKeys } from './queryKeys'

/** Published summaries, newest first, optionally for one course. */
export function usePublishedSummaries(filter: { courseId?: ID } = {}) {
  // The summary service.
  const { summaries } = useServices()
  // Cached list.
  return useQuery({
    queryKey: queryKeys.summaries.published(filter.courseId),
    queryFn: () => appQuery(() => summaries.listPublished(filter)),
  })
}

/**
 * One class's published summary. Pass `enabled: false` until the class is known to be published,
 * so no request is made for a summary that can't be shown.
 */
export function useClassSummary(classId: ID, { enabled }: Readonly<{ enabled: boolean }>) {
  // The summary service.
  const { summaries } = useServices()
  // Cached summary.
  return useQuery({
    queryKey: queryKeys.summaries.byClass(classId),
    queryFn: () => appQuery(() => summaries.getByClass(classId)),
    enabled,
  })
}

/** Records that the student opened a summary, then refreshes summary lists (FR-SUM-5). */
export function useMarkSummaryViewed() {
  // The summary service and the cache.
  const { summaries } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (summaryId: ID) => appQuery(() => summaries.markViewed(summaryId)),
    // The dashboard's "New Summaries" count and the list badges read these.
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.summaries.all }),
  })
}
