/**
 * Data hooks for published summaries. The summary view itself arrives in M5.
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
