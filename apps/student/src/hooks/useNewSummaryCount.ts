/**
 * How many published summaries the student hasn't opened yet, for the navigation's "n new".
 */

// The published summaries.
import { usePublishedSummaries } from '@/hooks/useSummaries'

/** The count; 0 while the summaries load or if they fail to load. */
export function useNewSummaryCount() {
  // The summaries.
  const summaries = usePublishedSummaries()
  // Those the student hasn't viewed.
  return summaries.data?.filter((summary) => !summary.viewedByMe).length ?? 0
}
