/**
 * Data hooks for the signed-in student's profile (FR-SET-1, FR-SET-3).
 */

// Cached reads, writes, and the cache.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// The update shape and the injected services.
import type { ProfileUpdate } from '@/services/types'
import { useServices } from '@/services/useServices'

// Error conversion for query functions.
import { appQuery } from './appQuery'
// Cache keys.
import { queryKeys } from './queryKeys'

/** The profile. */
export function useProfile() {
  // The profile service.
  const { profile } = useServices()
  // Cached profile.
  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => appQuery(() => profile.getMe()),
  })
}

/** Saves profile changes; the saved profile replaces the cached one. */
export function useUpdateProfile() {
  // The profile service and the cache.
  const { profile } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (changes: ProfileUpdate) => appQuery(() => profile.updateMe(changes)),
    // The service's answer is the new truth.
    onSuccess: (saved) => {
      client.setQueryData(queryKeys.profile.me(), saved)
    },
  })
}

/** Uploads a profile picture and returns its address, for useUpdateProfile. */
export function useUploadAvatar() {
  // The profile service.
  const { profile } = useServices()
  return useMutation({
    mutationFn: (file: File) => appQuery(() => profile.uploadAvatar(file)),
  })
}
