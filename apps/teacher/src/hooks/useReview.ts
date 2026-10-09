/**
 * The review screens' data (teacher REQUIREMENTS sections 8 and 9): the queue, one summary, and
 * saving and publishing a draft.
 */

// Server state, mutations and the cache.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Turns any failure into an AppError.
import { appQuery } from '@conote/core/appQuery'

// The services.
import { useServices } from '@/services/useServices'
// The draft's shape.
import type { ReviewDetails, SummaryDraft } from '@/types/review'

// Query keys.
import { queryKeys } from './queryKeys'

/** The teacher's summaries in review, longest wait first. */
export function useReviewQueue() {
  // The review service.
  const { review } = useServices()
  return useQuery({
    queryKey: queryKeys.review.queue(),
    queryFn: () => appQuery(() => review.listReviewQueue()),
  })
}

/**
 * One summary opened for review. Never refetched on its own: a refetch under the teacher's hands
 * must not replace what they are typing. Reloading is the teacher's choice.
 */
export function useReviewDetails(summaryId: string) {
  // The review service.
  const { review } = useServices()
  return useQuery({
    queryKey: queryKeys.review.details(summaryId),
    queryFn: () => appQuery(() => review.getDraft(summaryId)),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // Forgotten as soon as the page closes, so reopening always shows the latest draft.
    gcTime: 0,
  })
}

/** What saving or publishing sends. */
interface DraftChange {
  draft: SummaryDraft
  // The version the teacher loaded; a newer one means the draft changed meanwhile.
  version: number
}

/** Saves the draft. The saved summary replaces the cached one, so the next save has its version. */
export function useSaveDraft(summaryId: string) {
  // The review service and the cache.
  const { review } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ draft, version }: DraftChange) =>
      appQuery(() => review.saveDraft(summaryId, draft, version)),
    onSuccess: (saved: ReviewDetails) => {
      queryClient.setQueryData(queryKeys.review.details(summaryId), saved)
    },
  })
}

/** Publishes the draft. The queue and the course counts change, so they are refreshed. */
export function usePublishDraft(summaryId: string) {
  // The review service and the cache.
  const { review } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ draft, version }: DraftChange) =>
      appQuery(() => review.approveAndPublish(summaryId, draft, version)),
    onSuccess: (published: ReviewDetails) => {
      queryClient.setQueryData(queryKeys.review.details(summaryId), published)
      // The queue lost one, and the course cards and class rows changed stage.
      void queryClient.invalidateQueries({ queryKey: queryKeys.review.queue() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.teaching.all })
    },
  })
}
