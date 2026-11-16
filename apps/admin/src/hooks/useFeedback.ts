/**
 * The Feedback page's data (D125): one filtered page of feedback, and marking a piece new or read,
 * which refreshes the list.
 */

// Server state, mutations, the cache, and keeping the old page while the next loads.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The services.
import { useServices } from '@/services/useServices'
// The shapes.
import type { FeedbackFilter, FeedbackStatus } from '@/types/feedback'

// Query keys.
import { queryKeys } from './queryKeys'

/** One page of feedback. The previous page stays on screen while the next loads. */
export function useFeedbackList(filter: FeedbackFilter) {
  // The feedback service.
  const { feedback } = useServices()
  return useQuery({
    queryKey: queryKeys.feedback.list(filter),
    queryFn: () => appQuery(() => feedback.listFeedback(filter)),
    placeholderData: keepPreviousData,
  })
}

/** Marks a piece of feedback new or read, then refreshes every feedback list. */
export function useSetFeedbackStatus() {
  // The feedback service, and the cache to refresh.
  const { feedback } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (change: { id: string; status: FeedbackStatus }) =>
      appQuery(() => feedback.setFeedbackStatus(change.id, change.status)),
    // Hook-level, not in mutate(): the row may leave the filtered list and unmount its button.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.feedback.all }),
  })
}
